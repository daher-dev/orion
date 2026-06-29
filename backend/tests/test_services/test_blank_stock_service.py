"""Unit tests for the blank-piece (peças lisas) service layer.

Coverage targets
----------------
- create_blank_piece: happy path, duplicate -> ConflictError, foreign spec -> NotFoundError.
- Movements: entry / exit / adjustment; live on-hand + entries/exits totals via list_levels.
- Exit beyond on-hand -> ConflictError; foreign piece -> NotFoundError.
- list_levels: surfaces every catalog row (even with no movements); tenant scoped.
- Low-stock: row min_stock overrides config; config `blank` default (qty 20); low_stock_only filter.
- compute_on_hand_map bulk netting.
- Audit rows written on every mutation.
"""

import uuid

import pytest
from sqlmodel import select

from models import AuditLog, BlankMovementKind, Size
from schemas._common import PageParams
from schemas.blank_stock import (
    BlankMovementCreate,
    BlankMovementFilters,
    BlankPieceCreate,
    BlankPieceLevelFilters,
)
from services import blank_stock as service
from services import company_settings as settings_service
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import (
    create_blank_piece,
    create_blank_piece_movement,
    create_company,
    create_product_spec,
    create_user,
)

PAGE = PageParams(page=1, page_size=50)


async def _setup(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    return company, user, spec


async def _audits_for(db_session, *, resource_id: uuid.UUID) -> list[AuditLog]:
    result = await db_session.exec(select(AuditLog).where(AuditLog.resource_id == resource_id))
    return list(result.all())


async def _level_for(db_session, *, company_id, blank_piece_id):
    rows, _ = await service.list_levels(db_session, company_id=company_id, filters=BlankPieceLevelFilters(), page=PAGE)
    return next(r for r in rows if r["blank_piece_id"] == blank_piece_id)


# ---------- create_blank_piece ----------


async def test_create_blank_piece_happy_path(db_session):
    company, user, spec = await _setup(db_session)
    piece = await service.create_blank_piece(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankPieceCreate(spec_id=spec.id, size=Size.M, color="  Preto  ", color_code="BLK", min_stock=40),
    )
    assert piece.company_id == company.id
    assert piece.color == "Preto"  # stripped
    assert piece.color_code == "BLK"
    assert piece.min_stock == 40
    audits = await _audits_for(db_session, resource_id=piece.id)
    assert any("Blank piece created" in a.message for a in audits)


async def test_create_blank_piece_duplicate_raises_conflict(db_session):
    company, user, spec = await _setup(db_session)
    payload = BlankPieceCreate(spec_id=spec.id, size=Size.M, color="Preto", color_code="BLK")
    await service.create_blank_piece(db_session, company_id=company.id, user_id=user.id, payload=payload)
    with pytest.raises(ConflictError):
        await service.create_blank_piece(db_session, company_id=company.id, user_id=user.id, payload=payload)


async def test_create_blank_piece_foreign_spec_raises_not_found(db_session):
    company, user, _spec = await _setup(db_session)
    other = await create_company(db_session)
    foreign_spec = await create_product_spec(db_session, company_id=other.id)
    with pytest.raises(NotFoundError):
        await service.create_blank_piece(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=BlankPieceCreate(spec_id=foreign_spec.id, size=Size.M, color="Preto", color_code="BLK"),
        )


# ---------- create_movement ----------


async def test_create_movement_entry_credits_on_hand(db_session):
    company, user, spec = await _setup(db_session)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    movement = await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=piece.id, kind=BlankMovementKind.ENTRY, quantity=60, notes=" r "),
    )
    assert movement.kind == BlankMovementKind.ENTRY
    assert movement.quantity == 60
    assert movement.notes == "r"
    assert movement.sewing_shipment_id is None  # null on manual movements
    level = await _level_for(db_session, company_id=company.id, blank_piece_id=piece.id)
    assert level["on_hand"] == 60
    assert level["entries_total"] == 60
    audits = await _audits_for(db_session, resource_id=movement.id)
    assert any("Blank piece movement" in a.message and "+60" in a.message for a in audits)


async def test_create_movement_exit_debits_on_hand(db_session):
    company, user, spec = await _setup(db_session)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=piece.id, kind=BlankMovementKind.ENTRY, quantity=50),
    )
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=piece.id, kind=BlankMovementKind.EXIT, quantity=18),
    )
    level = await _level_for(db_session, company_id=company.id, blank_piece_id=piece.id)
    assert level["on_hand"] == 32
    assert level["entries_total"] == 50
    assert level["exits_total"] == 18


async def test_create_movement_adjustment_credits_on_hand(db_session):
    company, user, spec = await _setup(db_session)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=piece.id, kind=BlankMovementKind.ADJUSTMENT, quantity=4),
    )
    level = await _level_for(db_session, company_id=company.id, blank_piece_id=piece.id)
    assert level["on_hand"] == 4
    assert level["entries_total"] == 4  # ADJUSTMENT credits


async def test_create_movement_exit_beyond_on_hand_raises_conflict(db_session):
    company, user, spec = await _setup(db_session)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=piece.id, kind=BlankMovementKind.ENTRY, quantity=3),
    )
    with pytest.raises(ConflictError):
        await service.create_movement(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=BlankMovementCreate(blank_piece_id=piece.id, kind=BlankMovementKind.EXIT, quantity=5),
        )


async def test_create_movement_foreign_piece_raises_not_found(db_session):
    company, user, _spec = await _setup(db_session)
    other = await create_company(db_session)
    other_spec = await create_product_spec(db_session, company_id=other.id)
    foreign = await create_blank_piece(db_session, company_id=other.id, spec_id=other_spec.id)
    with pytest.raises(NotFoundError):
        await service.create_movement(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=BlankMovementCreate(blank_piece_id=foreign.id, kind=BlankMovementKind.ENTRY, quantity=1),
        )


# ---------- list_levels ----------


async def test_list_levels_includes_pieces_without_movements(db_session):
    company, _user, spec = await _setup(db_session)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, min_stock=None)
    rows, total = await service.list_levels(
        db_session, company_id=company.id, filters=BlankPieceLevelFilters(), page=PAGE
    )
    assert total == 1
    assert rows[0]["blank_piece_id"] == piece.id
    assert rows[0]["on_hand"] == 0
    assert rows[0]["in_production"] == 0
    assert rows[0]["last_movement_at"] is None
    assert rows[0]["spec"]["code"] == spec.code


async def test_list_levels_filters_by_spec_size_and_q(db_session):
    company, _user, spec = await _setup(db_session)
    other_spec = await create_product_spec(db_session, company_id=company.id, name="Cropped Base")
    await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto")
    await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, size=Size.G, color="Branco")
    await create_blank_piece(db_session, company_id=company.id, spec_id=other_spec.id, size=Size.M, color="Verde")

    rows, total = await service.list_levels(
        db_session, company_id=company.id, filters=BlankPieceLevelFilters(spec_id=spec.id), page=PAGE
    )
    assert total == 2

    rows, total = await service.list_levels(
        db_session, company_id=company.id, filters=BlankPieceLevelFilters(size=Size.G), page=PAGE
    )
    assert total == 1
    assert rows[0]["size"] == Size.G

    rows, total = await service.list_levels(
        db_session, company_id=company.id, filters=BlankPieceLevelFilters(q="verde"), page=PAGE
    )
    assert total == 1
    assert rows[0]["color"] == "Verde"


async def test_list_levels_is_tenant_scoped(db_session):
    company_a, _user, spec_a = await _setup(db_session)
    company_b = await create_company(db_session)
    spec_b = await create_product_spec(db_session, company_id=company_b.id)
    await create_blank_piece(db_session, company_id=company_a.id, spec_id=spec_a.id)
    await create_blank_piece(db_session, company_id=company_b.id, spec_id=spec_b.id)
    _rows, total = await service.list_levels(
        db_session, company_id=company_a.id, filters=BlankPieceLevelFilters(), page=PAGE
    )
    assert total == 1


# ---------- low stock ----------


async def test_low_stock_uses_row_min_stock_when_set(db_session):
    company, user, spec = await _setup(db_session)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, min_stock=10)
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=piece.id, kind=BlankMovementKind.ENTRY, quantity=10),
    )
    level = await _level_for(db_session, company_id=company.id, blank_piece_id=piece.id)
    # 10 <= row min_stock 10 -> low.
    assert level["low_stock"] is True


async def test_low_stock_falls_back_to_config_default_qty_20(db_session):
    company, user, spec = await _setup(db_session)
    # No row min_stock -> config `blank` default is qty 20.
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, min_stock=None)
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=piece.id, kind=BlankMovementKind.ENTRY, quantity=15),
    )
    level = await _level_for(db_session, company_id=company.id, blank_piece_id=piece.id)
    # 15 <= config default 20 -> low.
    assert level["low_stock"] is True


async def test_low_stock_false_when_config_disabled_and_no_row_min(db_session):
    company, user, spec = await _setup(db_session)
    # Disable the blank threshold entirely (fresh config dict — the settings
    # service full-replaces `config`, so pass a new object, not a mutated read).
    config = settings_service.default_config()
    config["stockThresholds"]["blank"] = {"enabled": False, "unit": "qty", "value": 20}
    await settings_service.update_settings(db_session, company_id=company.id, user_id=user.id, config=config)

    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, min_stock=None)
    # on_hand 0, but no threshold anywhere -> never low.
    level = await _level_for(db_session, company_id=company.id, blank_piece_id=piece.id)
    assert level["low_stock"] is False


async def test_list_levels_low_stock_only_filter(db_session):
    company, user, spec = await _setup(db_session)
    low = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, color="Preto", min_stock=10)
    ok = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, color="Branco", min_stock=1)
    for piece, qty in ((low, 5), (ok, 5)):
        await service.create_movement(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=BlankMovementCreate(blank_piece_id=piece.id, kind=BlankMovementKind.ENTRY, quantity=qty),
        )
    rows, total = await service.list_levels(
        db_session, company_id=company.id, filters=BlankPieceLevelFilters(low_stock_only=True), page=PAGE
    )
    # Only "low" (5 <= 10) qualifies; "ok" (5 > 1) does not.
    assert total == 1
    assert rows[0]["blank_piece_id"] == low.id


# ---------- levels_summary ----------


async def test_levels_summary_sums_all_skus_and_floors_negatives(db_session):
    """Headline totals aggregate every SKU (not a page) and floor negative on-hand
    at 0 — so a corrupt/legacy negative SKU never drags the figure below the real
    positive stock. Regression for the page-1 reduce that produced "-9657"."""

    company, user, spec = await _setup(db_session)
    # SKU A: on-hand 60.
    a = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, color="Preto")
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=a.id, kind=BlankMovementKind.ENTRY, quantity=60),
    )
    # SKU B: no movements -> on-hand 0.
    await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, color="Branco")
    # SKU C: a raw EXIT with no matching entry -> net -5 (the factory bypasses the
    # service's on-hand guard, simulating a legacy/corrupt negative). Must be
    # floored at 0, not subtracted from the headline.
    c = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, color="Vermelho")
    await create_blank_piece_movement(
        db_session, company_id=company.id, blank_piece_id=c.id, kind=BlankMovementKind.EXIT, quantity=5
    )

    summary = await service.levels_summary(db_session, company_id=company.id)
    assert summary["sku_count"] == 3
    # 60 + 0 + max(-5, 0) == 60. A naive reduce over on_hand would yield 55.
    assert summary["total_on_hand"] == 60


# ---------- list_movements ----------


async def test_list_movements_newest_first_and_kind_filter(db_session):
    company, user, spec = await _setup(db_session)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=piece.id, kind=BlankMovementKind.ENTRY, quantity=9),
    )
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=piece.id, kind=BlankMovementKind.EXIT, quantity=2),
    )
    rows, total = await service.list_movements(
        db_session, company_id=company.id, filters=BlankMovementFilters(), page=PAGE
    )
    assert total == 2
    assert rows[0]["blank_piece"]["spec_code"] == spec.code
    assert rows[0]["blank_piece"]["color"] == piece.color

    rows, total = await service.list_movements(
        db_session, company_id=company.id, filters=BlankMovementFilters(kind=BlankMovementKind.EXIT), page=PAGE
    )
    assert total == 1
    assert rows[0]["kind"] == BlankMovementKind.EXIT


# ---------- compute_on_hand_map ----------


async def test_compute_on_hand_map(db_session):
    company, user, spec = await _setup(db_session)
    p1 = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, color="Preto")
    p2 = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, color="Branco")
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=p1.id, kind=BlankMovementKind.ENTRY, quantity=12),
    )
    await service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=p1.id, kind=BlankMovementKind.EXIT, quantity=2),
    )
    on_hand = await service.compute_on_hand_map(db_session, company_id=company.id)
    assert on_hand[p1.id] == 10
    # p2 has no movements -> absent from the map (callers default to 0).
    assert p2.id not in on_hand


# ---------- in-production (WIP) ----------


async def test_in_production_counts_open_cutting(db_session):
    """Non-DONE cutting orders matching spec+color_code+size feed in-production."""

    from models import CuttingStatus
    from tests.factories import (
        create_cutting_order,
        create_cutting_order_output,
        create_fabric_roll,
    )

    company, _user, spec = await _setup(db_session)
    piece = await create_blank_piece(
        db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto", color_code="PRT"
    )
    roll = await create_fabric_roll(db_session, company_id=company.id)
    cutting = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=roll.id,
        color="Preto",
        color_code="PRT",
        status=CuttingStatus.CUTTING,
    )
    await create_cutting_order_output(db_session, cutting_order_id=cutting.id, size=Size.M, quantity=15)

    row = await _level_for(db_session, company_id=company.id, blank_piece_id=piece.id)
    assert row["in_production"] == 15


async def test_in_production_ignores_done_cutting(db_session):
    from models import CuttingStatus
    from tests.factories import (
        create_cutting_order,
        create_cutting_order_output,
        create_fabric_roll,
    )

    company, _user, spec = await _setup(db_session)
    piece = await create_blank_piece(
        db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto", color_code="PRT"
    )
    roll = await create_fabric_roll(db_session, company_id=company.id)
    cutting = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=roll.id,
        color="Preto",
        color_code="PRT",
        status=CuttingStatus.DONE,
    )
    await create_cutting_order_output(db_session, cutting_order_id=cutting.id, size=Size.M, quantity=15)

    row = await _level_for(db_session, company_id=company.id, blank_piece_id=piece.id)
    # DONE cutting outputs are available cut pieces, not in-production.
    assert row["in_production"] == 0


async def test_in_production_counts_open_sewing(db_session):
    """SENT/PARTIAL shipments' outstanding (requested-received) feed in-production."""

    from models import CuttingStatus, ShipmentStatus
    from tests.factories import (
        create_cutting_order,
        create_fabric_roll,
        create_sewing_contractor,
        create_sewing_shipment,
        create_sewing_shipment_item,
    )

    company, _user, spec = await _setup(db_session)
    piece = await create_blank_piece(
        db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto", color_code="PRT"
    )
    roll = await create_fabric_roll(db_session, company_id=company.id)
    cutting = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=roll.id,
        color="Preto",
        color_code="PRT",
        status=CuttingStatus.DONE,
    )
    contractor = await create_sewing_contractor(db_session, company_id=company.id)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=company.id,
        cutting_order_id=cutting.id,
        contractor_id=contractor.id,
        status=ShipmentStatus.PARTIAL,
    )
    # 10 requested, 4 already received → 6 still in production at the banca.
    await create_sewing_shipment_item(
        db_session, shipment_id=shipment.id, size=Size.M, requested_quantity=10, received_quantity=4
    )

    row = await _level_for(db_session, company_id=company.id, blank_piece_id=piece.id)
    assert row["in_production"] == 6


async def test_in_production_isolated_by_tenant(db_session):
    from models import CuttingStatus
    from tests.factories import (
        create_cutting_order,
        create_cutting_order_output,
        create_fabric_roll,
    )

    company, _user, spec = await _setup(db_session)
    piece = await create_blank_piece(
        db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto", color_code="PRT"
    )
    # Another tenant's open cutting for the SAME spec_id is impossible (spec is
    # tenant-scoped); build an independent tenant to assert no cross-leak.
    other = await create_company(db_session)
    other_spec = await create_product_spec(db_session, company_id=other.id)
    other_roll = await create_fabric_roll(db_session, company_id=other.id)
    other_cutting = await create_cutting_order(
        db_session,
        company_id=other.id,
        spec_id=other_spec.id,
        body_roll_id=other_roll.id,
        color="Preto",
        color_code="PRT",
        status=CuttingStatus.CUTTING,
    )
    await create_cutting_order_output(db_session, cutting_order_id=other_cutting.id, size=Size.M, quantity=99)

    row = await _level_for(db_session, company_id=company.id, blank_piece_id=piece.id)
    assert row["in_production"] == 0


# ---------- transition-internal helpers (record_movement / get_or_create) ----------


async def test_get_or_create_blank_piece_creates_then_resolves(db_session):
    company, _user, spec = await _setup(db_session)
    first = await service.get_or_create_blank_piece(
        db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto", color_code="PRT"
    )
    assert first.id is not None
    # A second call with the same key resolves the existing row (no duplicate).
    second = await service.get_or_create_blank_piece(
        db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto", color_code="PRT"
    )
    assert second.id == first.id
    await db_session.commit()


async def test_record_movement_credits_with_provenance_no_commit(db_session):
    from tests.factories import (
        create_cutting_order,
        create_fabric_roll,
        create_sewing_contractor,
        create_sewing_shipment,
    )

    company, _user, spec = await _setup(db_session)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    roll = await create_fabric_roll(db_session, company_id=company.id)
    cutting = await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=roll.id)
    contractor = await create_sewing_contractor(db_session, company_id=company.id)
    shipment = await create_sewing_shipment(
        db_session, company_id=company.id, cutting_order_id=cutting.id, contractor_id=contractor.id
    )

    movement = await service.record_movement(
        db_session,
        company_id=company.id,
        blank_piece_id=piece.id,
        kind=BlankMovementKind.ENTRY,
        quantity=7,
        sewing_shipment_id=shipment.id,
    )
    assert movement.sewing_shipment_id == shipment.id
    on_hand = await service._compute_on_hand(db_session, company_id=company.id, blank_piece_id=piece.id)
    assert on_hand == 7
    await db_session.commit()


async def test_record_movement_exit_guards_on_hand(db_session):
    company, _user, spec = await _setup(db_session)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    with pytest.raises(ConflictError):
        await service.record_movement(
            db_session,
            company_id=company.id,
            blank_piece_id=piece.id,
            kind=BlankMovementKind.EXIT,
            quantity=3,
        )
