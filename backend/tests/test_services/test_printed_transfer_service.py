"""Unit tests for the printed-transfer (estampados) service layer.

Coverage targets
----------------
- create_printed_transfer: happy path, duplicate -> ConflictError, foreign design -> NotFoundError.
- Movements: entry / exit / adjustment; live on-hand + entries/exits totals via list_levels.
- Exit beyond on-hand -> ConflictError; foreign transfer -> NotFoundError.
- list_levels: surfaces every catalog row (even with no movements); tenant scoped.
- Low-stock: row min_stock overrides config; config `printed` default (qty 10); low_stock_only filter.
- compute_on_hand_map bulk netting (keyed by printed_transfer_id).
- Audit rows written on every mutation.
"""

import uuid

import pytest
from sqlmodel import select

from models import AuditLog, PrintedMovementKind, PrintSide
from schemas._common import PageParams
from schemas.printed_transfer import (
    PrintedMovementCreate,
    PrintedMovementFilters,
    PrintedTransferCreate,
    PrintedTransferLevelFilters,
)
from services import company_settings as settings_service
from services import printed_transfer as service
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import (
    create_company,
    create_print_design,
    create_printed_transfer,
    create_user,
)

PAGE = PageParams(page=1, page_size=50)


async def _setup(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    design = await create_print_design(db_session, company_id=company.id, name="Naruto — Akatsuki")
    return company, user, design


async def _audits_for(db_session, *, resource_id: uuid.UUID) -> list[AuditLog]:
    result = await db_session.exec(select(AuditLog).where(AuditLog.resource_id == resource_id))
    return list(result.all())


async def _level_for(db_session, *, company_id, printed_transfer_id):
    rows, _ = await service.list_levels(
        db_session, company_id=company_id, filters=PrintedTransferLevelFilters(), page=PAGE
    )
    return next(r for r in rows if r["printed_transfer_id"] == printed_transfer_id)


# ---------- create_printed_transfer ----------


async def test_create_happy_path(db_session):
    company, user, design = await _setup(db_session)
    transfer = await service.create_printed_transfer(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintedTransferCreate(print_design_id=design.id, side=PrintSide.FRONT, min_stock=15),
    )
    assert transfer.company_id == company.id
    assert transfer.side == PrintSide.FRONT
    assert transfer.min_stock == 15
    audits = await _audits_for(db_session, resource_id=transfer.id)
    assert any("Printed transfer created" in a.message for a in audits)


async def test_create_duplicate_raises_conflict(db_session):
    company, user, design = await _setup(db_session)
    payload = PrintedTransferCreate(print_design_id=design.id, side=PrintSide.FRONT)
    await service.create_printed_transfer(db_session, company_id=company.id, user_id=user.id, payload=payload)
    with pytest.raises(ConflictError):
        await service.create_printed_transfer(db_session, company_id=company.id, user_id=user.id, payload=payload)


async def test_create_foreign_design_raises_not_found(db_session):
    company, user, _design = await _setup(db_session)
    other = await create_company(db_session)
    foreign_design = await create_print_design(db_session, company_id=other.id)
    with pytest.raises(NotFoundError):
        await service.create_printed_transfer(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=PrintedTransferCreate(print_design_id=foreign_design.id, side=PrintSide.FRONT),
        )


# ---------- create_movement ----------


async def test_create_movement_entry_credits_on_hand(db_session):
    company, user, design = await _setup(db_session)
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    movement = await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintedMovementCreate(printed_transfer_id=transfer.id, kind=PrintedMovementKind.ENTRY, quantity=30),
    )
    assert movement.quantity == 30
    level = await _level_for(db_session, company_id=company.id, printed_transfer_id=transfer.id)
    assert level["on_hand"] == 30
    assert level["entries_total"] == 30
    audits = await _audits_for(db_session, resource_id=movement.id)
    assert any("Printed transfer movement" in a.message and "+30" in a.message for a in audits)


async def test_create_movement_exit_debits_on_hand(db_session):
    company, user, design = await _setup(db_session)
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintedMovementCreate(printed_transfer_id=transfer.id, kind=PrintedMovementKind.ENTRY, quantity=14),
    )
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintedMovementCreate(printed_transfer_id=transfer.id, kind=PrintedMovementKind.EXIT, quantity=9),
    )
    level = await _level_for(db_session, company_id=company.id, printed_transfer_id=transfer.id)
    assert level["on_hand"] == 5
    assert level["exits_total"] == 9


async def test_create_movement_exit_beyond_on_hand_raises_conflict(db_session):
    company, user, design = await _setup(db_session)
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintedMovementCreate(printed_transfer_id=transfer.id, kind=PrintedMovementKind.ENTRY, quantity=2),
    )
    with pytest.raises(ConflictError):
        await service.create_movement(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=PrintedMovementCreate(printed_transfer_id=transfer.id, kind=PrintedMovementKind.EXIT, quantity=5),
        )


async def test_create_movement_foreign_transfer_raises_not_found(db_session):
    company, user, _design = await _setup(db_session)
    other = await create_company(db_session)
    other_design = await create_print_design(db_session, company_id=other.id)
    foreign = await create_printed_transfer(db_session, company_id=other.id, print_design_id=other_design.id)
    with pytest.raises(NotFoundError):
        await service.create_movement(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=PrintedMovementCreate(printed_transfer_id=foreign.id, kind=PrintedMovementKind.ENTRY, quantity=1),
        )


# ---------- list_levels ----------


async def test_list_levels_includes_transfers_without_movements(db_session):
    company, _user, design = await _setup(db_session)
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    rows, total = await service.list_levels(
        db_session, company_id=company.id, filters=PrintedTransferLevelFilters(), page=PAGE
    )
    assert total == 1
    assert rows[0]["printed_transfer_id"] == transfer.id
    assert rows[0]["on_hand"] == 0
    assert rows[0]["in_production"] == 0
    assert rows[0]["design"]["code"] == design.code
    assert rows[0]["design"]["name"] == design.name


async def test_list_levels_filters_by_design_side_and_q(db_session):
    company, _user, design = await _setup(db_session)
    other_design = await create_print_design(db_session, company_id=company.id, name="Gojo")
    await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id, side=PrintSide.FRONT)
    await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id, side=PrintSide.BACK)
    await create_printed_transfer(
        db_session, company_id=company.id, print_design_id=other_design.id, side=PrintSide.FRONT
    )

    rows, total = await service.list_levels(
        db_session, company_id=company.id, filters=PrintedTransferLevelFilters(print_design_id=design.id), page=PAGE
    )
    assert total == 2

    rows, total = await service.list_levels(
        db_session, company_id=company.id, filters=PrintedTransferLevelFilters(side=PrintSide.BACK), page=PAGE
    )
    assert total == 1
    assert rows[0]["side"] == PrintSide.BACK

    rows, total = await service.list_levels(
        db_session, company_id=company.id, filters=PrintedTransferLevelFilters(q="gojo"), page=PAGE
    )
    assert total == 1
    assert rows[0]["design"]["name"] == "Gojo"


async def test_list_levels_is_tenant_scoped(db_session):
    company_a, _user, design_a = await _setup(db_session)
    company_b = await create_company(db_session)
    design_b = await create_print_design(db_session, company_id=company_b.id)
    await create_printed_transfer(db_session, company_id=company_a.id, print_design_id=design_a.id)
    await create_printed_transfer(db_session, company_id=company_b.id, print_design_id=design_b.id)
    _rows, total = await service.list_levels(
        db_session, company_id=company_a.id, filters=PrintedTransferLevelFilters(), page=PAGE
    )
    assert total == 1


# ---------- low stock ----------


async def test_low_stock_uses_row_min_stock_when_set(db_session):
    company, user, design = await _setup(db_session)
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id, min_stock=12)
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintedMovementCreate(printed_transfer_id=transfer.id, kind=PrintedMovementKind.ENTRY, quantity=12),
    )
    level = await _level_for(db_session, company_id=company.id, printed_transfer_id=transfer.id)
    assert level["low_stock"] is True


async def test_low_stock_falls_back_to_config_default_qty_10(db_session):
    company, user, design = await _setup(db_session)
    transfer = await create_printed_transfer(
        db_session, company_id=company.id, print_design_id=design.id, min_stock=None
    )
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintedMovementCreate(printed_transfer_id=transfer.id, kind=PrintedMovementKind.ENTRY, quantity=8),
    )
    level = await _level_for(db_session, company_id=company.id, printed_transfer_id=transfer.id)
    # 8 <= config default 10 -> low.
    assert level["low_stock"] is True


async def test_low_stock_false_when_config_disabled_and_no_row_min(db_session):
    company, user, design = await _setup(db_session)
    # Fresh config dict — the settings service full-replaces `config`.
    config = settings_service.default_config()
    config["stockThresholds"]["printed"] = {"enabled": False, "unit": "qty", "value": 10}
    await settings_service.update_settings(db_session, company_id=company.id, user_id=user.id, config=config)

    transfer = await create_printed_transfer(
        db_session, company_id=company.id, print_design_id=design.id, min_stock=None
    )
    level = await _level_for(db_session, company_id=company.id, printed_transfer_id=transfer.id)
    assert level["low_stock"] is False


async def test_list_levels_low_stock_only_filter(db_session):
    company, user, design = await _setup(db_session)
    low = await create_printed_transfer(
        db_session, company_id=company.id, print_design_id=design.id, side=PrintSide.FRONT, min_stock=10
    )
    ok = await create_printed_transfer(
        db_session, company_id=company.id, print_design_id=design.id, side=PrintSide.BACK, min_stock=1
    )
    for transfer, qty in ((low, 5), (ok, 5)):
        await service.create_movement(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=PrintedMovementCreate(
                printed_transfer_id=transfer.id, kind=PrintedMovementKind.ENTRY, quantity=qty
            ),
        )
    rows, total = await service.list_levels(
        db_session, company_id=company.id, filters=PrintedTransferLevelFilters(low_stock_only=True), page=PAGE
    )
    assert total == 1
    assert rows[0]["printed_transfer_id"] == low.id


# ---------- list_movements ----------


async def test_list_movements_newest_first_and_filters(db_session):
    company, user, design = await _setup(db_session)
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintedMovementCreate(printed_transfer_id=transfer.id, kind=PrintedMovementKind.ENTRY, quantity=9),
    )
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintedMovementCreate(printed_transfer_id=transfer.id, kind=PrintedMovementKind.EXIT, quantity=2),
    )
    rows, total = await service.list_movements(
        db_session, company_id=company.id, filters=PrintedMovementFilters(), page=PAGE
    )
    assert total == 2
    assert rows[0]["design"]["code"] == design.code
    assert rows[0]["side"] == transfer.side

    rows, total = await service.list_movements(
        db_session,
        company_id=company.id,
        filters=PrintedMovementFilters(kind=PrintedMovementKind.EXIT),
        page=PAGE,
    )
    assert total == 1
    assert rows[0]["kind"] == PrintedMovementKind.EXIT

    # Filter by design / side composes through the joined transfer.
    rows, total = await service.list_movements(
        db_session, company_id=company.id, filters=PrintedMovementFilters(print_design_id=design.id), page=PAGE
    )
    assert total == 2


# ---------- compute_on_hand_map ----------


async def test_compute_on_hand_map_keyed_by_transfer_id(db_session):
    company, user, design = await _setup(db_session)
    t1 = await create_printed_transfer(
        db_session, company_id=company.id, print_design_id=design.id, side=PrintSide.FRONT
    )
    t2 = await create_printed_transfer(
        db_session, company_id=company.id, print_design_id=design.id, side=PrintSide.BACK
    )
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintedMovementCreate(printed_transfer_id=t1.id, kind=PrintedMovementKind.ENTRY, quantity=20),
    )
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintedMovementCreate(printed_transfer_id=t1.id, kind=PrintedMovementKind.EXIT, quantity=3),
    )
    on_hand = await service.compute_on_hand_map(db_session, company_id=company.id)
    assert on_hand[t1.id] == 17
    assert t2.id not in on_hand
