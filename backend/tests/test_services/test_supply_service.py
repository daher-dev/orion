"""Unit tests for the supply (insumos) service layer.

Coverage targets
----------------
- CRUD: create / list (q-search) / get / update / delete.
- Tenant isolation: a foreign supply is not visible / raises NotFoundError.
- Movements: entry / exit / adjustment; live on-hand via list_supply_levels.
- Exit beyond on-hand raises ConflictError.
- Delete blocked when movements exist -> ConflictError.
- Audit rows written on every mutation.
"""

import uuid
from decimal import Decimal

import pytest
from sqlmodel import select

from models import AuditLog, Supply, SupplyMovementKind
from schemas._common import PageParams
from schemas.supply import (
    SupplyCreate,
    SupplyFilters,
    SupplyLevelFilters,
    SupplyMovementCreate,
    SupplyMovementFilters,
    SupplyUpdate,
)
from services import supply as supply_service
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import (
    create_company,
    create_supply,
    create_supply_movement,
    create_user,
)

PAGE = PageParams(page=1, page_size=50)


async def _setup(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    return company, user


async def _audits_for(db_session, *, resource_id: uuid.UUID) -> list[AuditLog]:
    result = await db_session.exec(select(AuditLog).where(AuditLog.resource_id == resource_id))
    return list(result.all())


# ---------- create_supply ----------


async def test_create_supply_happy_path(db_session):
    company, user = await _setup(db_session)
    supply = await supply_service.create_supply(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=SupplyCreate(
            name="  Linha branca  ",
            unit="m",
            unit_cost=Decimal("3.50"),
            min_stock=Decimal("100.000"),
            notes="  spool  ",
        ),
    )
    assert supply.id is not None
    assert supply.company_id == company.id
    assert supply.name == "Linha branca"  # stripped
    assert supply.unit == "m"
    assert supply.unit_cost == Decimal("3.50")
    assert supply.min_stock == Decimal("100.000")
    assert supply.notes == "spool"  # stripped

    audits = await _audits_for(db_session, resource_id=supply.id)
    assert any("Supply created" in a.message for a in audits)


async def test_create_supply_defaults_optional_fields_to_none(db_session):
    company, user = await _setup(db_session)
    supply = await supply_service.create_supply(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=SupplyCreate(name="Etiqueta", unit="un", unit_cost=Decimal("0.10")),
    )
    assert supply.min_stock is None
    assert supply.notes is None


# ---------- list_supplies ----------


async def test_list_supplies_orders_by_name_and_filters_by_q(db_session):
    company, _user = await _setup(db_session)
    await create_supply(db_session, company_id=company.id, name="Zíper", unit="un")
    await create_supply(db_session, company_id=company.id, name="Botão", unit="un")
    await create_supply(db_session, company_id=company.id, name="Elástico", unit="m")

    items, total = await supply_service.list_supplies(
        db_session, company_id=company.id, filters=SupplyFilters(), page=PAGE
    )
    assert total == 3
    assert [s.name for s in items] == ["Botão", "Elástico", "Zíper"]

    items, total = await supply_service.list_supplies(
        db_session, company_id=company.id, filters=SupplyFilters(q="bot"), page=PAGE
    )
    assert total == 1
    assert items[0].name == "Botão"


async def test_list_supplies_is_tenant_scoped(db_session):
    company_a, _user_a = await _setup(db_session)
    company_b = await create_company(db_session)
    await create_supply(db_session, company_id=company_a.id, name="A item")
    await create_supply(db_session, company_id=company_b.id, name="B item")

    items, total = await supply_service.list_supplies(
        db_session, company_id=company_a.id, filters=SupplyFilters(), page=PAGE
    )
    assert total == 1
    assert items[0].name == "A item"


# ---------- get_supply ----------


async def test_get_supply_found(db_session):
    company, _ = await _setup(db_session)
    supply = await create_supply(db_session, company_id=company.id)
    fetched = await supply_service.get_supply(db_session, company_id=company.id, supply_id=supply.id)
    assert fetched.id == supply.id


async def test_get_supply_foreign_tenant_raises_not_found(db_session):
    company_a, _ = await _setup(db_session)
    company_b = await create_company(db_session)
    foreign = await create_supply(db_session, company_id=company_b.id)
    with pytest.raises(NotFoundError):
        await supply_service.get_supply(db_session, company_id=company_a.id, supply_id=foreign.id)


async def test_get_supply_missing_raises_not_found(db_session):
    company, _ = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await supply_service.get_supply(db_session, company_id=company.id, supply_id=uuid.uuid4())


# ---------- update_supply ----------


async def test_update_supply_partial(db_session):
    company, user = await _setup(db_session)
    supply = await create_supply(db_session, company_id=company.id, name="Old", unit_cost=Decimal("1.00"))
    updated = await supply_service.update_supply(
        db_session,
        company_id=company.id,
        user_id=user.id,
        supply_id=supply.id,
        payload=SupplyUpdate(name="  New  ", unit_cost=Decimal("9.99")),
    )
    assert updated.name == "New"
    assert updated.unit_cost == Decimal("9.99")
    audits = await _audits_for(db_session, resource_id=supply.id)
    assert any("Supply updated" in a.message for a in audits)


async def test_update_supply_can_clear_min_stock(db_session):
    company, user = await _setup(db_session)
    supply = await create_supply(db_session, company_id=company.id, min_stock=Decimal("5.000"))
    updated = await supply_service.update_supply(
        db_session,
        company_id=company.id,
        user_id=user.id,
        supply_id=supply.id,
        payload=SupplyUpdate(min_stock=None),
    )
    # An explicit null in the request body clears the threshold.
    assert updated.min_stock is None


async def test_update_supply_foreign_tenant_raises_not_found(db_session):
    company_a, user_a = await _setup(db_session)
    company_b = await create_company(db_session)
    foreign = await create_supply(db_session, company_id=company_b.id)
    with pytest.raises(NotFoundError):
        await supply_service.update_supply(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            supply_id=foreign.id,
            payload=SupplyUpdate(name="hack"),
        )


# ---------- delete_supply ----------


async def test_delete_supply_happy_path(db_session):
    company, user = await _setup(db_session)
    supply = await create_supply(db_session, company_id=company.id)
    await supply_service.delete_supply(db_session, company_id=company.id, user_id=user.id, supply_id=supply.id)
    remaining = (await db_session.exec(select(Supply).where(Supply.id == supply.id))).first()
    assert remaining is None


async def test_delete_supply_blocked_when_movements_exist(db_session):
    company, user = await _setup(db_session)
    supply = await create_supply(db_session, company_id=company.id)
    await create_supply_movement(db_session, company_id=company.id, supply_id=supply.id, kind=SupplyMovementKind.ENTRY)
    with pytest.raises(ConflictError):
        await supply_service.delete_supply(db_session, company_id=company.id, user_id=user.id, supply_id=supply.id)
    # The supply must still exist after the blocked delete.
    remaining = (await db_session.exec(select(Supply).where(Supply.id == supply.id))).first()
    assert remaining is not None


# ---------- create_movement ----------


async def test_create_movement_entry(db_session):
    company, user = await _setup(db_session)
    supply = await create_supply(db_session, company_id=company.id, name="Fita")
    movement = await supply_service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=SupplyMovementCreate(
            supply_id=supply.id, kind=SupplyMovementKind.ENTRY, quantity=Decimal("15.500"), notes="  buy  "
        ),
    )
    assert movement.kind == SupplyMovementKind.ENTRY
    assert movement.quantity == Decimal("15.500")
    assert movement.notes == "buy"
    audits = await _audits_for(db_session, resource_id=movement.id)
    assert any("Supply movement for Fita" in a.message and "+15.500" in a.message for a in audits)


async def test_create_movement_exit_decrements_on_hand(db_session):
    company, user = await _setup(db_session)
    supply = await create_supply(db_session, company_id=company.id)
    await supply_service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=SupplyMovementCreate(supply_id=supply.id, kind=SupplyMovementKind.ENTRY, quantity=Decimal("20")),
    )
    await supply_service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=SupplyMovementCreate(supply_id=supply.id, kind=SupplyMovementKind.EXIT, quantity=Decimal("7.250")),
    )
    rows, _ = await supply_service.list_supply_levels(
        db_session, company_id=company.id, filters=SupplyLevelFilters(), page=PAGE
    )
    assert rows[0]["on_hand"] == Decimal("12.750")
    assert rows[0]["entries_total"] == Decimal("20")
    assert rows[0]["exits_total"] == Decimal("7.250")


async def test_create_movement_adjustment_credits_on_hand(db_session):
    company, user = await _setup(db_session)
    supply = await create_supply(db_session, company_id=company.id)
    await supply_service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=SupplyMovementCreate(
            supply_id=supply.id, kind=SupplyMovementKind.ADJUSTMENT, quantity=Decimal("4.000")
        ),
    )
    rows, _ = await supply_service.list_supply_levels(
        db_session, company_id=company.id, filters=SupplyLevelFilters(), page=PAGE
    )
    assert rows[0]["on_hand"] == Decimal("4.000")
    # ADJUSTMENT credits, so it lands in entries_total.
    assert rows[0]["entries_total"] == Decimal("4.000")


async def test_create_movement_exit_beyond_on_hand_raises_conflict(db_session):
    company, user = await _setup(db_session)
    supply = await create_supply(db_session, company_id=company.id)
    await supply_service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=SupplyMovementCreate(supply_id=supply.id, kind=SupplyMovementKind.ENTRY, quantity=Decimal("3")),
    )
    with pytest.raises(ConflictError):
        await supply_service.create_movement(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=SupplyMovementCreate(supply_id=supply.id, kind=SupplyMovementKind.EXIT, quantity=Decimal("5")),
        )


async def test_create_movement_foreign_supply_raises_not_found(db_session):
    company_a, user_a = await _setup(db_session)
    company_b = await create_company(db_session)
    foreign = await create_supply(db_session, company_id=company_b.id)
    with pytest.raises(NotFoundError):
        await supply_service.create_movement(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            payload=SupplyMovementCreate(supply_id=foreign.id, kind=SupplyMovementKind.ENTRY, quantity=Decimal("1")),
        )


# ---------- list_supply_levels ----------


async def test_list_supply_levels_includes_supplies_without_movements(db_session):
    company, _ = await _setup(db_session)
    await create_supply(db_session, company_id=company.id, name="Untouched")
    rows, total = await supply_service.list_supply_levels(
        db_session, company_id=company.id, filters=SupplyLevelFilters(), page=PAGE
    )
    assert total == 1
    assert rows[0]["on_hand"] == Decimal("0")
    assert rows[0]["last_movement_at"] is None


async def test_list_supply_levels_low_stock_only(db_session):
    company, user = await _setup(db_session)
    low = await create_supply(db_session, company_id=company.id, name="Low", min_stock=Decimal("10.000"))
    ok = await create_supply(db_session, company_id=company.id, name="Ok", min_stock=Decimal("1.000"))
    # No threshold -> never flagged as low even at 0.
    await create_supply(db_session, company_id=company.id, name="NoThreshold")

    for s in (low, ok):
        await supply_service.create_movement(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=SupplyMovementCreate(supply_id=s.id, kind=SupplyMovementKind.ENTRY, quantity=Decimal("5")),
        )

    rows, total = await supply_service.list_supply_levels(
        db_session, company_id=company.id, filters=SupplyLevelFilters(low_stock_only=True), page=PAGE
    )
    # Only "Low" (5 <= 10) qualifies; "Ok" (5 > 1) and "NoThreshold" do not.
    assert total == 1
    assert rows[0]["name"] == "Low"


async def test_list_supply_levels_is_tenant_scoped(db_session):
    company_a, _ = await _setup(db_session)
    company_b = await create_company(db_session)
    await create_supply(db_session, company_id=company_a.id, name="A")
    await create_supply(db_session, company_id=company_b.id, name="B")
    rows, total = await supply_service.list_supply_levels(
        db_session, company_id=company_a.id, filters=SupplyLevelFilters(), page=PAGE
    )
    assert total == 1
    assert rows[0]["name"] == "A"


# ---------- list_movements ----------


async def test_list_movements_newest_first_and_filters(db_session):
    company, user = await _setup(db_session)
    supply = await create_supply(db_session, company_id=company.id)
    await supply_service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=SupplyMovementCreate(supply_id=supply.id, kind=SupplyMovementKind.ENTRY, quantity=Decimal("9")),
    )
    await supply_service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=SupplyMovementCreate(supply_id=supply.id, kind=SupplyMovementKind.EXIT, quantity=Decimal("2")),
    )

    rows, total = await supply_service.list_movements(
        db_session, company_id=company.id, filters=SupplyMovementFilters(), page=PAGE
    )
    assert total == 2
    assert rows[0]["supply"]["name"] == supply.name

    rows, total = await supply_service.list_movements(
        db_session,
        company_id=company.id,
        filters=SupplyMovementFilters(kind=SupplyMovementKind.EXIT),
        page=PAGE,
    )
    assert total == 1
    assert rows[0]["kind"] == SupplyMovementKind.EXIT


async def test_list_movements_is_tenant_scoped(db_session):
    company_a, _user_a = await _setup(db_session)
    company_b = await create_company(db_session)
    supply_b = await create_supply(db_session, company_id=company_b.id)
    await create_supply_movement(db_session, company_id=company_b.id, supply_id=supply_b.id)
    _rows, total = await supply_service.list_movements(
        db_session, company_id=company_a.id, filters=SupplyMovementFilters(), page=PAGE
    )
    assert total == 0
