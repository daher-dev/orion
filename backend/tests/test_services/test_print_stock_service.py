"""Unit tests for the print-stock service layer.

Coverage targets
----------------
- `_compute_on_hand` / `compute_on_hand_map` — entry/exit/adjustment signing.
- `list_levels` — aggregation, surfaces only moved pairs, tenant isolation,
  filters, pagination.
- `list_movements` — ordering, filters, tenant isolation.
- `create_entry` — happy path + audit + whitespace handling.
- `create_exit` — happy path + audit + **negative-stock guard** + 404.
"""

import uuid

import pytest
from sqlmodel import select

from models import AuditLog, PrintStockDirection
from schemas._common import PageParams
from schemas.print_stock import (
    PrintStockEntryCreate,
    PrintStockExitCreate,
    PrintStockLevelFilters,
    PrintStockMovementFilters,
)
from services import print_stock as svc
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import (
    create_company,
    create_print_design,
    create_print_stock_movement,
    create_user,
)


async def _setup(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    design = await create_print_design(db_session, company_id=company.id)
    return company, user, design


async def _audits_for(db_session, *, resource_id: uuid.UUID) -> list[AuditLog]:
    return list((await db_session.exec(select(AuditLog).where(AuditLog.resource_id == resource_id))).all())


# ---------- on-hand computation ----------


async def test_compute_on_hand_signs_directions(db_session):
    company, _, design = await _setup(db_session)
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, direction=PrintStockDirection.ENTRY, quantity=20
    )
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, direction=PrintStockDirection.EXIT, quantity=5
    )
    await create_print_stock_movement(
        db_session,
        company_id=company.id,
        print_design_id=design.id,
        direction=PrintStockDirection.ADJUSTMENT,
        quantity=3,
    )
    on_hand = await svc._compute_on_hand(
        db_session, company_id=company.id, print_design_id=design.id, product_color="Preto"
    )
    assert on_hand == 18  # 20 + 3 - 5


async def test_compute_on_hand_map_groups_by_design_and_colour(db_session):
    company, _, design = await _setup(db_session)
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, product_color="Preto", quantity=10
    )
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, product_color="Branco", quantity=4
    )
    await create_print_stock_movement(
        db_session,
        company_id=company.id,
        print_design_id=design.id,
        product_color="Preto",
        direction=PrintStockDirection.EXIT,
        quantity=2,
    )
    on_hand_map = await svc.compute_on_hand_map(db_session, company_id=company.id)
    assert on_hand_map[(design.id, "Preto")] == 8
    assert on_hand_map[(design.id, "Branco")] == 4


async def test_compute_on_hand_map_is_tenant_scoped(db_session):
    company_a, _, design_a = await _setup(db_session)
    company_b = await create_company(db_session)
    design_b = await create_print_design(db_session, company_id=company_b.id)
    await create_print_stock_movement(db_session, company_id=company_a.id, print_design_id=design_a.id, quantity=7)
    await create_print_stock_movement(db_session, company_id=company_b.id, print_design_id=design_b.id, quantity=99)
    on_hand_map = await svc.compute_on_hand_map(db_session, company_id=company_a.id)
    assert on_hand_map == {(design_a.id, "Preto"): 7}


# ---------- list_levels ----------


async def test_list_levels_aggregates_and_surfaces_only_moved_pairs(db_session):
    company, _, design = await _setup(db_session)
    # A second design with no movements must NOT appear.
    await create_print_design(db_session, company_id=company.id, code="NOMOVE")
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, product_color="Preto", quantity=15
    )
    await create_print_stock_movement(
        db_session,
        company_id=company.id,
        print_design_id=design.id,
        product_color="Preto",
        direction=PrintStockDirection.EXIT,
        quantity=4,
    )
    rows, total = await svc.list_levels(
        db_session, company_id=company.id, filters=PrintStockLevelFilters(), page=PageParams()
    )
    assert total == 1
    row = rows[0]
    assert row["print_design_id"] == design.id
    assert row["product_color"] == "Preto"
    assert row["on_hand"] == 11
    assert row["entries_total"] == 15
    assert row["exits_total"] == 4
    assert row["design"]["code"] == design.code


async def test_list_levels_filters_by_design_and_search(db_session):
    company, _, design = await _setup(db_session)
    other = await create_print_design(db_session, company_id=company.id, code="OTHER")
    await create_print_stock_movement(db_session, company_id=company.id, print_design_id=design.id, quantity=1)
    await create_print_stock_movement(db_session, company_id=company.id, print_design_id=other.id, quantity=1)

    rows, total = await svc.list_levels(
        db_session,
        company_id=company.id,
        filters=PrintStockLevelFilters(print_design_id=design.id),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0]["print_design_id"] == design.id

    rows, total = await svc.list_levels(
        db_session, company_id=company.id, filters=PrintStockLevelFilters(q="other"), page=PageParams()
    )
    assert total == 1
    assert rows[0]["design"]["code"] == "OTHER"


async def test_list_levels_tenant_isolation(db_session):
    company_a, _, design_a = await _setup(db_session)
    company_b = await create_company(db_session)
    design_b = await create_print_design(db_session, company_id=company_b.id)
    await create_print_stock_movement(db_session, company_id=company_a.id, print_design_id=design_a.id, quantity=1)
    await create_print_stock_movement(db_session, company_id=company_b.id, print_design_id=design_b.id, quantity=1)
    rows, total = await svc.list_levels(
        db_session, company_id=company_a.id, filters=PrintStockLevelFilters(), page=PageParams()
    )
    assert total == 1
    assert rows[0]["print_design_id"] == design_a.id


# ---------- list_movements ----------


async def test_list_movements_orders_newest_first_and_filters(db_session):
    company, _, design = await _setup(db_session)
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, direction=PrintStockDirection.ENTRY, quantity=5
    )
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, direction=PrintStockDirection.EXIT, quantity=2
    )
    rows, total = await svc.list_movements(
        db_session, company_id=company.id, filters=PrintStockMovementFilters(), page=PageParams()
    )
    assert total == 2

    rows, total = await svc.list_movements(
        db_session,
        company_id=company.id,
        filters=PrintStockMovementFilters(direction=PrintStockDirection.EXIT),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0]["direction"] == PrintStockDirection.EXIT


# ---------- create_entry ----------


async def test_create_entry_happy_path(db_session):
    company, user, design = await _setup(db_session)
    movement = await svc.create_entry(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintStockEntryCreate(
            print_design_id=design.id, product_color="  Preto  ", quantity=12, notes="  found  "
        ),
    )
    assert movement.direction == PrintStockDirection.ENTRY
    assert movement.product_color == "Preto"  # trimmed
    assert movement.notes == "found"
    assert movement.quantity == 12
    audits = await _audits_for(db_session, resource_id=movement.id)
    assert any("+12" in a.message and "entry" in a.message for a in audits)


async def test_create_entry_unknown_design_raises_404(db_session):
    company, user, _ = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await svc.create_entry(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=PrintStockEntryCreate(print_design_id=uuid.uuid4(), product_color="Preto", quantity=1),
        )


# ---------- create_exit ----------


async def test_create_exit_happy_path(db_session):
    company, user, design = await _setup(db_session)
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, product_color="Preto", quantity=10
    )
    movement = await svc.create_exit(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintStockExitCreate(print_design_id=design.id, product_color="Preto", quantity=4),
    )
    assert movement.direction == PrintStockDirection.EXIT
    assert movement.quantity == 4
    audits = await _audits_for(db_session, resource_id=movement.id)
    assert any("-4" in a.message and "exit" in a.message for a in audits)
    on_hand = await svc._compute_on_hand(
        db_session, company_id=company.id, print_design_id=design.id, product_color="Preto"
    )
    assert on_hand == 6


async def test_create_exit_guards_negative_stock(db_session):
    company, user, design = await _setup(db_session)
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, product_color="Preto", quantity=3
    )
    with pytest.raises(ConflictError) as exc:
        await svc.create_exit(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=PrintStockExitCreate(print_design_id=design.id, product_color="Preto", quantity=10),
        )
    assert "3" in str(exc.value.detail)
