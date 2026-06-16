"""Unit tests for the Print Orders (Impressão) service layer — T4.

Coverage targets
----------------
- create: happy path; silkscreen rejected (422); paper-type ↔ technique
  mismatch (422); variation/side not on design (422); duplicate pairs (422).
- status machine: legal + illegal transitions; PATCH to done posts nothing.
- printed_outputs replace-set + check constraint (printed ≤ planned).
- complete: meters = rate * total vs explicit override; per-side sum across
  variations; idempotency (re-complete is a no-op).
- tenant isolation.
"""

from decimal import Decimal

import pytest
from sqlmodel import select

from models import (
    PaperRoll,
    PaperRollMovement,
    PaperType,
    PrintedTransfer,
    PrintOrderStatus,
    PrintSide,
    PrintTechnique,
)
from schemas._common import PageParams
from schemas.print_order import (
    PrintOrderComplete,
    PrintOrderCreate,
    PrintOrderFilters,
    PrintOrderOutputItem,
    PrintOrderOutputItem2,
    PrintOrderUpdate,
)
from services import print_order as service
from services import printed_transfer as printed_transfer_service
from shared.exceptions import ConflictError, NotFoundError, ValidationError
from tests.factories import (
    create_company,
    create_paper_roll,
    create_print_design,
    create_print_design_variation,
    create_user,
)

PAGE = PageParams(page=1, page_size=50)


async def _setup(db_session, *, technique=PrintTechnique.DTF, has_front=True, has_back=False):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    design = await create_print_design(
        db_session,
        company_id=company.id,
        technique=technique,
        has_front=has_front,
        has_back=has_back,
    )
    variation = await create_print_design_variation(db_session, company_id=company.id, print_design_id=design.id)
    return company, user, design, variation


# ---------- create ----------


async def test_create_happy(db_session):
    company, user, design, variation = await _setup(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, paper_type=PaperType.DTF_FILM)
    read = await service.create_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintOrderCreate(
            print_design_id=design.id,
            paper_roll_id=roll.id,
            planned_outputs=[
                PrintOrderOutputItem(print_design_variation_id=variation.id, side=PrintSide.FRONT, planned_quantity=8)
            ],
        ),
    )
    assert read.status == PrintOrderStatus.PENDING
    assert read.code.startswith("IM-")
    assert read.total_planned == 8
    assert read.paper_roll is not None
    assert read.outputs[0].variation.id == variation.id


async def test_create_rejects_silkscreen(db_session):
    company, user, design, _variation = await _setup(db_session, technique=PrintTechnique.SILKSCREEN)
    with pytest.raises(ValidationError):
        await service.create_print_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=PrintOrderCreate(print_design_id=design.id),
        )


async def test_create_rejects_incompatible_paper(db_session):
    # DTF design with a sublimation-paper roll → 422.
    company, user, design, _variation = await _setup(db_session, technique=PrintTechnique.DTF)
    roll = await create_paper_roll(db_session, company_id=company.id, paper_type=PaperType.SUBLIMATION_PAPER)
    with pytest.raises(ValidationError):
        await service.create_print_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=PrintOrderCreate(print_design_id=design.id, paper_roll_id=roll.id),
        )


async def test_create_accepts_sublimation_with_transfer_paper(db_session):
    company, user, design, _variation = await _setup(db_session, technique=PrintTechnique.SUBLIMATION)
    roll = await create_paper_roll(db_session, company_id=company.id, paper_type=PaperType.TRANSFER_PAPER)
    read = await service.create_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintOrderCreate(print_design_id=design.id, paper_roll_id=roll.id),
    )
    assert read.technique == PrintTechnique.SUBLIMATION
    assert read.rate_m_per_piece == 0.5


async def test_create_rejects_back_side_when_design_has_no_back(db_session):
    company, user, design, variation = await _setup(db_session, has_front=True, has_back=False)
    with pytest.raises(ValidationError):
        await service.create_print_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=PrintOrderCreate(
                print_design_id=design.id,
                planned_outputs=[
                    PrintOrderOutputItem(
                        print_design_variation_id=variation.id, side=PrintSide.BACK, planned_quantity=4
                    )
                ],
            ),
        )


async def test_create_rejects_foreign_variation(db_session):
    company, user, design, _variation = await _setup(db_session)
    other_design = await create_print_design(db_session, company_id=company.id, has_front=True)
    other_variation = await create_print_design_variation(
        db_session, company_id=company.id, print_design_id=other_design.id
    )
    with pytest.raises(ValidationError):
        await service.create_print_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=PrintOrderCreate(
                print_design_id=design.id,
                planned_outputs=[
                    PrintOrderOutputItem(
                        print_design_variation_id=other_variation.id, side=PrintSide.FRONT, planned_quantity=4
                    )
                ],
            ),
        )


async def test_create_missing_design_404(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    import uuid

    with pytest.raises(NotFoundError):
        await service.create_print_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=PrintOrderCreate(print_design_id=uuid.uuid4()),
        )


# ---------- status machine ----------


async def test_status_machine_legal_and_illegal(db_session):
    company, user, design, _variation = await _setup(db_session)
    created = await service.create_print_order(
        db_session, company_id=company.id, user_id=user.id, payload=PrintOrderCreate(print_design_id=design.id)
    )
    # pending → printing OK.
    moved = await service.update_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=created.id,
        payload=PrintOrderUpdate(status=PrintOrderStatus.PRINTING),
    )
    assert moved.status == PrintOrderStatus.PRINTING
    # printing → done OK (posts nothing — printed_at stays null).
    done = await service.update_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=created.id,
        payload=PrintOrderUpdate(status=PrintOrderStatus.DONE),
    )
    assert done.status == PrintOrderStatus.DONE
    assert done.printed_at is None
    # done → pending is illegal.
    with pytest.raises(ConflictError):
        await service.update_print_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=created.id,
            payload=PrintOrderUpdate(status=PrintOrderStatus.PENDING),
        )


# ---------- complete ----------


async def test_complete_meters_from_rate(db_session):
    company, user, design, variation = await _setup(db_session)
    roll = await create_paper_roll(
        db_session, company_id=company.id, paper_type=PaperType.DTF_FILM, current_meters=Decimal("50.00")
    )
    created = await service.create_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintOrderCreate(
            print_design_id=design.id,
            paper_roll_id=roll.id,
            planned_outputs=[
                PrintOrderOutputItem(print_design_variation_id=variation.id, side=PrintSide.FRONT, planned_quantity=10)
            ],
        ),
    )
    await service.update_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=created.id,
        payload=PrintOrderUpdate(
            printed_outputs=[
                PrintOrderOutputItem2(print_design_variation_id=variation.id, side=PrintSide.FRONT, printed_quantity=10)
            ]
        ),
    )
    completed = await service.complete_print_order(
        db_session, company_id=company.id, user_id=user.id, order_id=created.id, payload=PrintOrderComplete()
    )
    # 0.35 * 10 = 3.50 m.
    assert completed.meters_consumed == Decimal("3.50")
    refreshed = (await db_session.exec(select(PaperRoll).where(PaperRoll.id == roll.id))).first()
    assert refreshed.current_meters == Decimal("46.50")


async def test_complete_meters_override(db_session):
    company, user, design, variation = await _setup(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, paper_type=PaperType.DTF_FILM)
    created = await service.create_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintOrderCreate(
            print_design_id=design.id,
            paper_roll_id=roll.id,
            planned_outputs=[
                PrintOrderOutputItem(print_design_variation_id=variation.id, side=PrintSide.FRONT, planned_quantity=10)
            ],
        ),
    )
    await service.update_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=created.id,
        payload=PrintOrderUpdate(
            printed_outputs=[
                PrintOrderOutputItem2(print_design_variation_id=variation.id, side=PrintSide.FRONT, printed_quantity=10)
            ]
        ),
    )
    completed = await service.complete_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=created.id,
        payload=PrintOrderComplete(meters_consumed=Decimal("7.00")),
    )
    assert completed.meters_consumed == Decimal("7.00")


async def test_complete_sums_printed_per_side_across_variations(db_session):
    company, user, design, variation = await _setup(db_session, has_front=True, has_back=True)
    variation2 = await create_print_design_variation(
        db_session, company_id=company.id, print_design_id=design.id, name="Branco", ink_hex="#ffffff"
    )
    created = await service.create_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintOrderCreate(
            print_design_id=design.id,
            planned_outputs=[
                PrintOrderOutputItem(print_design_variation_id=variation.id, side=PrintSide.FRONT, planned_quantity=5),
                PrintOrderOutputItem(print_design_variation_id=variation2.id, side=PrintSide.FRONT, planned_quantity=4),
                PrintOrderOutputItem(print_design_variation_id=variation.id, side=PrintSide.BACK, planned_quantity=3),
            ],
        ),
    )
    await service.update_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=created.id,
        payload=PrintOrderUpdate(
            printed_outputs=[
                PrintOrderOutputItem2(print_design_variation_id=variation.id, side=PrintSide.FRONT, printed_quantity=5),
                PrintOrderOutputItem2(
                    print_design_variation_id=variation2.id, side=PrintSide.FRONT, printed_quantity=4
                ),
                PrintOrderOutputItem2(print_design_variation_id=variation.id, side=PrintSide.BACK, printed_quantity=3),
            ]
        ),
    )
    await service.complete_print_order(
        db_session, company_id=company.id, user_id=user.id, order_id=created.id, payload=PrintOrderComplete()
    )
    # Front transfer = 5 + 4 = 9; back transfer = 3.
    front = (
        await db_session.exec(
            select(PrintedTransfer).where(
                PrintedTransfer.print_design_id == design.id, PrintedTransfer.side == PrintSide.FRONT
            )
        )
    ).first()
    back = (
        await db_session.exec(
            select(PrintedTransfer).where(
                PrintedTransfer.print_design_id == design.id, PrintedTransfer.side == PrintSide.BACK
            )
        )
    ).first()
    assert (
        await printed_transfer_service._compute_on_hand(db_session, company_id=company.id, printed_transfer_id=front.id)
        == 9
    )
    assert (
        await printed_transfer_service._compute_on_hand(db_session, company_id=company.id, printed_transfer_id=back.id)
        == 3
    )


async def test_complete_idempotent(db_session):
    company, user, design, variation = await _setup(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, paper_type=PaperType.DTF_FILM)
    created = await service.create_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintOrderCreate(
            print_design_id=design.id,
            paper_roll_id=roll.id,
            planned_outputs=[
                PrintOrderOutputItem(print_design_variation_id=variation.id, side=PrintSide.FRONT, planned_quantity=10)
            ],
        ),
    )
    await service.update_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=created.id,
        payload=PrintOrderUpdate(
            printed_outputs=[
                PrintOrderOutputItem2(print_design_variation_id=variation.id, side=PrintSide.FRONT, printed_quantity=10)
            ]
        ),
    )
    await service.complete_print_order(
        db_session, company_id=company.id, user_id=user.id, order_id=created.id, payload=PrintOrderComplete()
    )
    await service.complete_print_order(
        db_session, company_id=company.id, user_id=user.id, order_id=created.id, payload=PrintOrderComplete()
    )
    # Only one paper EXIT movement despite two complete calls.
    moves = list(
        (await db_session.exec(select(PaperRollMovement).where(PaperRollMovement.print_order_id == created.id))).all()
    )
    assert len(moves) == 1
    front = (await db_session.exec(select(PrintedTransfer).where(PrintedTransfer.print_design_id == design.id))).first()
    assert (
        await printed_transfer_service._compute_on_hand(db_session, company_id=company.id, printed_transfer_id=front.id)
        == 10
    )


# ---------- tenant isolation ----------


async def test_list_is_tenant_scoped(db_session):
    company, user, design, _variation = await _setup(db_session)
    other = await create_company(db_session)
    other_design = await create_print_design(db_session, company_id=other.id)
    await service.create_print_order(
        db_session, company_id=company.id, user_id=user.id, payload=PrintOrderCreate(print_design_id=design.id)
    )
    other_user = await create_user(db_session, company_id=other.id)
    await service.create_print_order(
        db_session,
        company_id=other.id,
        user_id=other_user.id,
        payload=PrintOrderCreate(print_design_id=other_design.id),
    )
    items, total = await service.list_print_orders(
        db_session, company_id=company.id, filters=PrintOrderFilters(), page=PAGE
    )
    assert total == 1
    assert items[0].design.id == design.id


async def test_get_other_tenant_404(db_session):
    company, _user, _design, _variation = await _setup(db_session)
    other = await create_company(db_session)
    other_design = await create_print_design(db_session, company_id=other.id)
    other_user = await create_user(db_session, company_id=other.id)
    created = await service.create_print_order(
        db_session,
        company_id=other.id,
        user_id=other_user.id,
        payload=PrintOrderCreate(print_design_id=other_design.id),
    )
    with pytest.raises(NotFoundError):
        await service.get_print_order(db_session, company_id=company.id, order_id=created.id)
