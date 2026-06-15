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
