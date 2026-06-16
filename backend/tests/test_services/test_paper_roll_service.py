"""Unit tests for the paper-roll (bobinas de papel/filme) service layer.

Coverage targets
----------------
- CRUD: create (defaults current<-initial; current>initial -> 409), list (q + paper_type), get, update
  (cross-field current<=initial -> 409), delete (blocked when movements exist).
- consume: debits current_meters, clamps at 0, records an EXIT movement.
- create_movement: entry/adjustment add to current; exit clamps at 0; writes ledger row.
- list_movements: newest first + filters; tenant scoped.
- low_stock: row min_stock (absolute) overrides config pct-of-initial; low_stock_only filter.
- Audit rows written on every mutation.
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlmodel import select

from models import AuditLog, PaperMovementKind, PaperRoll, PaperRollMovement, PaperType
from schemas._common import PageParams
from schemas.paper_roll import (
    PaperMovementCreate,
    PaperMovementFilters,
    PaperRollConsume,
    PaperRollCreate,
    PaperRollFilters,
    PaperRollUpdate,
)
from services import company_settings as settings_service
from services import paper_roll as service
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import create_company, create_paper_roll, create_paper_roll_movement, create_user

PAGE = PageParams(page=1, page_size=50)


async def _setup(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    return company, user


async def _audits_for(db_session, *, resource_id: uuid.UUID) -> list[AuditLog]:
    result = await db_session.exec(select(AuditLog).where(AuditLog.resource_id == resource_id))
    return list(result.all())


def _create_payload(**overrides) -> PaperRollCreate:
    base = {
        "received_at": date(2026, 6, 1),
        "supplier_name": "DTF Brasil",
        "paper_type": PaperType.DTF_FILM,
        "width_cm": 60,
        "initial_meters": Decimal("100.00"),
    }
    base.update(overrides)
    return PaperRollCreate(**base)


# ---------- create_paper_roll ----------


async def test_create_defaults_current_to_initial(db_session):
    company, user = await _setup(db_session)
    roll = await service.create_paper_roll(
        db_session, company_id=company.id, user_id=user.id, payload=_create_payload(supplier_name="  DTF  ")
    )
    assert roll.current_meters == Decimal("100.00")
    assert roll.supplier_name == "DTF"  # stripped
    audits = await _audits_for(db_session, resource_id=roll.id)
    assert any("Paper roll created" in a.message for a in audits)


async def test_create_current_exceeds_initial_raises_conflict(db_session):
    company, user = await _setup(db_session)
    with pytest.raises(ConflictError):
        await service.create_paper_roll(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=_create_payload(current_meters=Decimal("150.00")),
        )


# ---------- list_paper_rolls ----------


async def test_list_filters_by_q_and_type(db_session):
    company, _user = await _setup(db_session)
    await create_paper_roll(
        db_session, company_id=company.id, supplier_name="DTF Brasil", paper_type=PaperType.DTF_FILM
    )
    await create_paper_roll(
        db_session, company_id=company.id, supplier_name="SubliPrint", paper_type=PaperType.SUBLIMATION_PAPER
    )

    rows, total = await service.list_paper_rolls(
        db_session, company_id=company.id, filters=PaperRollFilters(q="subli"), page=PAGE
    )
    assert total == 1
    assert rows[0].supplier_name == "SubliPrint"

    rows, total = await service.list_paper_rolls(
        db_session, company_id=company.id, filters=PaperRollFilters(paper_type=PaperType.DTF_FILM), page=PAGE
    )
    assert total == 1
    assert rows[0].paper_type == PaperType.DTF_FILM


async def test_list_is_tenant_scoped(db_session):
    company_a, _user = await _setup(db_session)
    company_b = await create_company(db_session)
    await create_paper_roll(db_session, company_id=company_a.id)
    await create_paper_roll(db_session, company_id=company_b.id)
    _rows, total = await service.list_paper_rolls(
        db_session, company_id=company_a.id, filters=PaperRollFilters(), page=PAGE
    )
    assert total == 1


# ---------- get_paper_roll ----------


async def test_get_foreign_raises_not_found(db_session):
    company_a, _user = await _setup(db_session)
    company_b = await create_company(db_session)
    foreign = await create_paper_roll(db_session, company_id=company_b.id)
    with pytest.raises(NotFoundError):
        await service.get_paper_roll(db_session, company_id=company_a.id, roll_id=foreign.id)


# ---------- update_paper_roll ----------


async def test_update_partial_and_clear_min_stock(db_session):
    company, user = await _setup(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, min_stock=Decimal("20.00"))
    updated = await service.update_paper_roll(
        db_session,
        company_id=company.id,
        user_id=user.id,
        roll_id=roll.id,
        payload=PaperRollUpdate(supplier_name="  New Co  ", min_stock=None),
    )
    assert updated.supplier_name == "New Co"
    assert updated.min_stock is None  # explicit null clears


async def test_update_current_exceeds_initial_raises_conflict(db_session):
    company, user = await _setup(db_session)
    roll = await create_paper_roll(
        db_session, company_id=company.id, initial_meters=Decimal("100.00"), current_meters=Decimal("50.00")
    )
    with pytest.raises(ConflictError):
        await service.update_paper_roll(
            db_session,
            company_id=company.id,
            user_id=user.id,
            roll_id=roll.id,
            payload=PaperRollUpdate(current_meters=Decimal("120.00")),
        )


# ---------- delete_paper_roll ----------


async def test_delete_happy_path(db_session):
    company, user = await _setup(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id)
    await service.delete_paper_roll(db_session, company_id=company.id, user_id=user.id, roll_id=roll.id)
    remaining = (await db_session.exec(select(PaperRoll).where(PaperRoll.id == roll.id))).first()
    assert remaining is None


async def test_delete_blocked_when_movements_exist(db_session):
    company, user = await _setup(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id)
    await create_paper_roll_movement(db_session, company_id=company.id, paper_roll_id=roll.id)
    with pytest.raises(ConflictError):
        await service.delete_paper_roll(db_session, company_id=company.id, user_id=user.id, roll_id=roll.id)
    remaining = (await db_session.exec(select(PaperRoll).where(PaperRoll.id == roll.id))).first()
    assert remaining is not None


# ---------- consume ----------


async def test_consume_debits_current_and_records_exit(db_session):
    company, user = await _setup(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, current_meters=Decimal("64.00"))
    updated = await service.consume(
        db_session,
        company_id=company.id,
        user_id=user.id,
        roll_id=roll.id,
        payload=PaperRollConsume(quantity=Decimal("22.000")),
    )
    assert updated.current_meters == Decimal("42.00")
    movements = (
        await db_session.exec(select(PaperRollMovement).where(PaperRollMovement.paper_roll_id == roll.id))
    ).all()
    assert len(movements) == 1
    assert movements[0].kind == PaperMovementKind.EXIT
    assert movements[0].quantity == Decimal("22.000")


async def test_consume_clamps_at_zero(db_session):
    company, user = await _setup(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, current_meters=Decimal("5.00"))
    updated = await service.consume(
        db_session,
        company_id=company.id,
        user_id=user.id,
        roll_id=roll.id,
        payload=PaperRollConsume(quantity=Decimal("18.000")),
    )
    # current clamps at 0; the recorded movement is the actual consumed (5).
    assert updated.current_meters == Decimal("0.00")
    movements = (
        await db_session.exec(select(PaperRollMovement).where(PaperRollMovement.paper_roll_id == roll.id))
    ).all()
    assert movements[0].quantity == Decimal("5.00")


# ---------- create_movement ----------


async def test_create_movement_entry_adds_to_current(db_session):
    company, user = await _setup(db_session)
    roll = await create_paper_roll(
        db_session, company_id=company.id, initial_meters=Decimal("100.00"), current_meters=Decimal("40.00")
    )
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PaperMovementCreate(paper_roll_id=roll.id, kind=PaperMovementKind.ENTRY, quantity=Decimal("30.000")),
    )
    refreshed = await service.get_paper_roll(db_session, company_id=company.id, roll_id=roll.id)
    assert refreshed.current_meters == Decimal("70.00")


async def test_create_movement_exit_clamps_current_at_zero(db_session):
    company, user = await _setup(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, current_meters=Decimal("4.00"))
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PaperMovementCreate(paper_roll_id=roll.id, kind=PaperMovementKind.EXIT, quantity=Decimal("10.000")),
    )
    refreshed = await service.get_paper_roll(db_session, company_id=company.id, roll_id=roll.id)
    assert refreshed.current_meters == Decimal("0.00")


async def test_create_movement_foreign_roll_raises_not_found(db_session):
    company_a, user_a = await _setup(db_session)
    company_b = await create_company(db_session)
    foreign = await create_paper_roll(db_session, company_id=company_b.id)
    with pytest.raises(NotFoundError):
        await service.create_movement(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            payload=PaperMovementCreate(
                paper_roll_id=foreign.id, kind=PaperMovementKind.ENTRY, quantity=Decimal("1.000")
            ),
        )


# ---------- list_movements ----------


async def test_list_movements_newest_first_and_filters(db_session):
    company, user = await _setup(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id)
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PaperMovementCreate(paper_roll_id=roll.id, kind=PaperMovementKind.ENTRY, quantity=Decimal("9.000")),
    )
    await service.consume(
        db_session,
        company_id=company.id,
        user_id=user.id,
        roll_id=roll.id,
        payload=PaperRollConsume(quantity=Decimal("2.000")),
    )
    rows, total = await service.list_movements(
        db_session, company_id=company.id, filters=PaperMovementFilters(), page=PAGE
    )
    assert total == 2
    assert rows[0]["paper_roll"]["supplier_name"] == roll.supplier_name

    rows, total = await service.list_movements(
        db_session, company_id=company.id, filters=PaperMovementFilters(kind=PaperMovementKind.EXIT), page=PAGE
    )
    assert total == 1
    assert rows[0]["kind"] == PaperMovementKind.EXIT


async def test_list_movements_is_tenant_scoped(db_session):
    company_a, _user = await _setup(db_session)
    company_b = await create_company(db_session)
    roll_b = await create_paper_roll(db_session, company_id=company_b.id)
    await create_paper_roll_movement(db_session, company_id=company_b.id, paper_roll_id=roll_b.id)
    _rows, total = await service.list_movements(
        db_session, company_id=company_a.id, filters=PaperMovementFilters(), page=PAGE
    )
    assert total == 0


# ---------- low stock ----------


async def test_low_stock_row_min_overrides_config(db_session):
    company, _user = await _setup(db_session)
    # min_stock 50 absolute floor; current 40 <= 50 -> low.
    roll = await create_paper_roll(
        db_session, company_id=company.id, current_meters=Decimal("40.00"), min_stock=Decimal("50.00")
    )
    read = await service.to_read(db_session, company_id=company.id, roll=roll)
    assert read["low_stock"] is True
    assert read["on_hand"] == Decimal("40.00")
    assert read["consumed_meters"] == roll.initial_meters - Decimal("40.00")


async def test_low_stock_config_pct_of_initial(db_session):
    company, _user = await _setup(db_session)
    # Config `paper` default: pct 25 of initial. initial 100 -> threshold 25.
    # current 20 <= 25 -> low; current 30 > 25 -> not low.
    low_roll = await create_paper_roll(
        db_session, company_id=company.id, initial_meters=Decimal("100.00"), current_meters=Decimal("20.00")
    )
    ok_roll = await create_paper_roll(
        db_session, company_id=company.id, initial_meters=Decimal("100.00"), current_meters=Decimal("30.00")
    )
    assert (await service.to_read(db_session, company_id=company.id, roll=low_roll))["low_stock"] is True
    assert (await service.to_read(db_session, company_id=company.id, roll=ok_roll))["low_stock"] is False


async def test_low_stock_false_when_config_disabled_and_no_row_min(db_session):
    company, user = await _setup(db_session)
    # Fresh config dict — the settings service full-replaces `config`.
    config = settings_service.default_config()
    config["stockThresholds"]["paper"] = {"enabled": False, "unit": "pct", "value": 25}
    await settings_service.update_settings(db_session, company_id=company.id, user_id=user.id, config=config)

    roll = await create_paper_roll(db_session, company_id=company.id, current_meters=Decimal("0.00"))
    assert (await service.to_read(db_session, company_id=company.id, roll=roll))["low_stock"] is False


async def test_list_low_stock_only_filter(db_session):
    company, _user = await _setup(db_session)
    # Default pct 25 of initial. low (20<=25) qualifies, ok (40>25) does not.
    await create_paper_roll(
        db_session,
        company_id=company.id,
        supplier_name="LowCo",
        initial_meters=Decimal("100.00"),
        current_meters=Decimal("20.00"),
    )
    await create_paper_roll(
        db_session,
        company_id=company.id,
        supplier_name="OkCo",
        initial_meters=Decimal("100.00"),
        current_meters=Decimal("40.00"),
    )
    rows, total = await service.list_paper_rolls(
        db_session, company_id=company.id, filters=PaperRollFilters(low_stock_only=True), page=PAGE
    )
    assert total == 1
    assert rows[0].supplier_name == "LowCo"
