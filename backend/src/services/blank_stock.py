"""Service layer for the Blank Pieces (peças lisas) WIP inventory tier.

Convention notes
----------------
- A ``BlankPiece`` is a print-agnostic blank garment body keyed by
  ``(spec_id, size, color_code)`` (clones the ``services.supply`` catalog +
  append-only ledger pattern, but with integer counts like finished-piece
  Stock).
- On-hand is computed live from the append-only ``blank_piece_movements``
  ledger — there is NO materialised balance column. A single table carries a
  ``kind`` enum; ENTRY and ADJUSTMENT credit stock, EXIT debits it (every row
  holds a strictly-positive ``quantity``). This mirrors ``services.supply``
  ``_SIGNED_QTY``.
- ``list_levels`` surfaces ONE row per blank piece (a row with zero movements
  still appears, with on-hand 0) so the catalog stays the source of truth —
  unlike the old ``print_stock`` levels which only surfaced moved pairs.
- ``low_stock`` is computed per row from the row-level ``min_stock`` if set,
  else the company-wide ``stockThresholds["blank"]`` (absolute count compare).
- ``create_movement`` enforces the no-negative-on-hand invariant for EXIT by
  re-aggregating on the fly before writing (racey under heavy concurrency;
  accepted for v1 since movements happen at human-input pace). ``create_blank_piece``
  lets the manual move sheet target a new ``(spec, size, color)`` key.
- ``sewing_shipment_id`` provenance stays null on manual movements — it is set
  only by the T3 sewing-receipt transition (Phase 3).
- Every SELECT is tenant-scoped via :func:`scoped`; mutations write a single
  audit entry under ``blank_pieces`` / ``blank_piece_movements``.
"""

from __future__ import annotations

import uuid
from datetime import datetime, time
from typing import Any

from sqlalchemy import String, case, cast, func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    BlankMovementKind,
    BlankPiece,
    BlankPieceMovement,
    CuttingOrder,
    CuttingOrderOutput,
    CuttingStatus,
    ProductSpec,
    SewingShipment,
    SewingShipmentItem,
    ShipmentStatus,
    Size,
)
from schemas._common import PageParams
from schemas.blank_stock import (
    BlankMovementCreate,
    BlankMovementFilters,
    BlankPieceCreate,
    BlankPieceLevelFilters,
)
from services import company_settings as settings_service
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError

_RESOURCE = "blank_pieces"
_MOVEMENT_RESOURCE = "blank_piece_movements"
_THRESHOLD_KEY = "blank"

# ENTRY + ADJUSTMENT credit stock; EXIT debits it.
_CREDIT_KINDS = (BlankMovementKind.ENTRY, BlankMovementKind.ADJUSTMENT)

# A signed-quantity SQL expression: +quantity for credits, -quantity for exits.
_SIGNED_QTY = case(
    (BlankPieceMovement.kind == BlankMovementKind.EXIT, -BlankPieceMovement.quantity),
    else_=BlankPieceMovement.quantity,
)


# ---------- helpers ----------


async def _get_blank_piece(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    blank_piece_id: uuid.UUID,
) -> BlankPiece:
    stmt = scoped(select(BlankPiece), BlankPiece, company_id).where(BlankPiece.id == blank_piece_id)
    piece = (await db.exec(stmt)).first()
    if piece is None:
        raise NotFoundError(detail="Blank piece not found")
    return piece


async def _compute_on_hand(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    blank_piece_id: uuid.UUID,
) -> int:
    """Current on-hand for a single blank piece (signed sum of ledger rows)."""

    stmt = scoped(select(func.coalesce(func.sum(_SIGNED_QTY), 0)), BlankPieceMovement, company_id).where(
        BlankPieceMovement.blank_piece_id == blank_piece_id
    )
    return int((await db.exec(stmt)).first() or 0)


async def compute_on_hand_map(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
) -> dict[uuid.UUID, int]:
    """Return ``{blank_piece_id: on_hand}`` for the tenant (bulk netting).

    Single aggregation — used by downstream consumers (Assembly P4, Planning P5)
    so they don't issue one query per blank piece. Only blank pieces with a
    non-zero history are present; callers default missing keys to 0.
    """

    stmt = scoped(
        select(
            BlankPieceMovement.blank_piece_id,
            func.coalesce(func.sum(_SIGNED_QTY), 0).label("on_hand"),
        ),
        BlankPieceMovement,
        company_id,
    ).group_by(BlankPieceMovement.blank_piece_id)
    result = await db.exec(stmt)
    return {row[0]: int(row[1] or 0) for row in result.all()}


def _is_low_stock(*, on_hand: int, row_min_stock: int | None, threshold: dict[str, Any] | None) -> bool:
    """Counted-tier low-stock rule: row ``min_stock`` if set, else config value.

    Absolute comparison (``on_hand <= effective_threshold``). When neither a
    row threshold nor an enabled config threshold exists, never low.
    """

    if row_min_stock is not None:
        return on_hand <= row_min_stock
    if threshold and threshold.get("enabled") and threshold.get("value") is not None:
        return on_hand <= int(threshold["value"])
    return False


# ---------- catalog create ----------


async def create_blank_piece(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: BlankPieceCreate,
) -> BlankPiece:
    """Create an empty blank-piece catalog row (so the move sheet can target a new key).

    The spec must belong to the tenant; the ``(company_id, spec_id, size,
    color_code)`` unique constraint guards against duplicates (surfaced as 409).
    """

    spec_stmt = scoped(select(ProductSpec), ProductSpec, company_id).where(ProductSpec.id == payload.spec_id)
    if (await db.exec(spec_stmt)).first() is None:
        raise NotFoundError(detail="Product spec not found")

    existing_stmt = scoped(select(BlankPiece), BlankPiece, company_id).where(
        BlankPiece.spec_id == payload.spec_id,
        BlankPiece.size == payload.size,
        BlankPiece.color_code == payload.color_code,
    )
    if (await db.exec(existing_stmt)).first() is not None:
        raise ConflictError(detail="Blank piece already exists for this spec/size/color")

    piece = BlankPiece(
        company_id=company_id,
        spec_id=payload.spec_id,
        size=payload.size,
        color=payload.color.strip(),
        color_code=payload.color_code,
        min_stock=payload.min_stock,
    )
    db.add(piece)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=piece.id,
        message=f"Blank piece created: {piece.size.value}/{piece.color} ({piece.color_code})",
    )
    await db.commit()
    await db.refresh(piece)
    return piece


# ---------- in-production (WIP) ----------


async def _in_production_map(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    keys: set[tuple[uuid.UUID, str, Size]],
) -> dict[tuple[uuid.UUID, str, Size], int]:
    """Compute in-production WIP per ``(spec_id, color_code, size)``.

    ``in_production = open_cutting + open_sewing`` for the tier:

    - **open_cutting** = Σ ``CuttingOrderOutput.quantity`` over cutting orders
      with ``status != DONE`` matching ``(spec_id, color_code)`` (with the
      single-row output model, a non-DONE order's full output is in-production).
    - **open_sewing** = Σ ``max(0, requested - received)`` over
      ``SewingShipmentItem`` of shipments in {SENT, PARTIAL} whose cutting order
      matches ``(spec_id, color_code)``.

    Both queries are tenant-scoped and grouped by ``(spec_id, color_code, size)``,
    then netted in Python against the page's keys (the blank catalog is small).
    Keys absent from the result default to 0 at the call site.
    """

    result: dict[tuple[uuid.UUID, str, Size], int] = {}
    if not keys:
        return result

    spec_ids = {k[0] for k in keys}

    # open_cutting: non-DONE cutting orders' outputs, keyed by spec+color_code+size.
    cutting_stmt = (
        scoped(
            select(
                CuttingOrder.spec_id,
                CuttingOrder.color_code,
                CuttingOrderOutput.size,
                func.coalesce(func.sum(CuttingOrderOutput.quantity), 0),
            ),
            CuttingOrder,
            company_id,
        )
        .join(CuttingOrderOutput, CuttingOrderOutput.cutting_order_id == CuttingOrder.id)
        .where(
            CuttingOrder.status != CuttingStatus.DONE,
            CuttingOrder.spec_id.in_(spec_ids),  # type: ignore[attr-defined]
        )
        .group_by(CuttingOrder.spec_id, CuttingOrder.color_code, CuttingOrderOutput.size)
    )
    for spec_id, color_code, size, total in (await db.exec(cutting_stmt)).all():
        key = (spec_id, color_code, size)
        result[key] = result.get(key, 0) + int(total or 0)

    # open_sewing: SENT/PARTIAL shipments' outstanding (requested - received),
    # keyed by the cutting order's spec+color_code + the item size.
    open_qty = func.coalesce(
        func.sum(
            case(
                (
                    SewingShipmentItem.requested_quantity > SewingShipmentItem.received_quantity,
                    SewingShipmentItem.requested_quantity - SewingShipmentItem.received_quantity,
                ),
                else_=0,
            )
        ),
        0,
    )
    sewing_stmt = (
        scoped(
            select(
                CuttingOrder.spec_id,
                CuttingOrder.color_code,
                SewingShipmentItem.size,
                open_qty,
            ),
            SewingShipment,
            company_id,
        )
        # Anchor the FROM explicitly on SewingShipment (the scoped model) so the
        # joins to its item rows + the cutting order it draws from resolve
        # cleanly (selecting only CuttingOrder/Item columns would otherwise leave
        # SewingShipment unjoined → a cross join).
        .select_from(SewingShipment)
        .join(SewingShipmentItem, SewingShipmentItem.shipment_id == SewingShipment.id)
        .join(CuttingOrder, CuttingOrder.id == SewingShipment.cutting_order_id)
        .where(
            SewingShipment.status.in_((ShipmentStatus.SENT, ShipmentStatus.PARTIAL)),  # type: ignore[attr-defined]
            CuttingOrder.spec_id.in_(spec_ids),  # type: ignore[attr-defined]
        )
        .group_by(CuttingOrder.spec_id, CuttingOrder.color_code, SewingShipmentItem.size)
    )
    for spec_id, color_code, size, total in (await db.exec(sewing_stmt)).all():
        key = (spec_id, color_code, size)
        result[key] = result.get(key, 0) + int(total or 0)

    return {k: v for k, v in result.items() if k in keys}


# ---------- list_levels ----------


async def list_levels(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: BlankPieceLevelFilters,
    page: PageParams,
) -> tuple[list[dict], int]:
    """Paginated rows of ``(blank_piece, spec, on_hand, entries/exits totals)``.

    Every blank piece in the catalog is surfaced (on-hand 0 when it has no
    movements). ``low_stock`` is computed in Python per row (the config
    threshold lives in JSONB, not SQL-filterable cleanly).
    """

    entries_sum = func.coalesce(
        func.sum(case((BlankPieceMovement.kind.in_(_CREDIT_KINDS), BlankPieceMovement.quantity), else_=0)), 0
    )
    exits_sum = func.coalesce(
        func.sum(case((BlankPieceMovement.kind == BlankMovementKind.EXIT, BlankPieceMovement.quantity), else_=0)), 0
    )

    agg = (
        scoped(
            select(
                BlankPieceMovement.blank_piece_id.label("blank_piece_id"),
                entries_sum.label("entries_total"),
                exits_sum.label("exits_total"),
                func.max(BlankPieceMovement.created_at).label("last_movement_at"),
            ),
            BlankPieceMovement,
            company_id,
        )
        .group_by(BlankPieceMovement.blank_piece_id)
        .subquery()
    )

    entries_total_expr = func.coalesce(agg.c.entries_total, 0)
    exits_total_expr = func.coalesce(agg.c.exits_total, 0)
    on_hand_expr = entries_total_expr - exits_total_expr

    base = (
        select(
            BlankPiece,
            ProductSpec,
            entries_total_expr.label("entries_total"),
            exits_total_expr.label("exits_total"),
            on_hand_expr.label("on_hand"),
            agg.c.last_movement_at,
        )
        .join(ProductSpec, ProductSpec.id == BlankPiece.spec_id)
        .outerjoin(agg, agg.c.blank_piece_id == BlankPiece.id)
        .where(BlankPiece.company_id == company_id)
    )

    if filters.spec_id is not None:
        base = base.where(BlankPiece.spec_id == filters.spec_id)
    if filters.size is not None:
        base = base.where(BlankPiece.size == filters.size)
    if filters.q:
        like = f"%{filters.q.strip().lower()}%"
        base = base.where(
            or_(
                func.lower(ProductSpec.code).like(like),
                func.lower(ProductSpec.name).like(like),
                func.lower(BlankPiece.color).like(like),
                func.lower(BlankPiece.color_code).like(like),
            )
        )

    # The threshold source is read once per request (config lives in JSONB).
    settings = await settings_service.get_settings(db, company_id=company_id)
    threshold = settings.config.get("stockThresholds", {}).get(_THRESHOLD_KEY)

    # `low_stock` is config-driven, so the `low_stock_only` filter is applied in
    # Python after fetch. To keep pagination correct we fetch all matching rows,
    # filter, then slice — acceptable since the blank catalog is small per tenant.
    if filters.low_stock_only:
        rows_stmt = base.order_by(ProductSpec.code.asc(), BlankPiece.size.asc(), BlankPiece.color.asc())
        result = await db.exec(rows_stmt)
        filtered = [
            row
            for row in result.all()
            if _is_low_stock(on_hand=int(row[4] or 0), row_min_stock=row[0].min_stock, threshold=threshold)
        ]
        total = len(filtered)
        page_rows = filtered[page.offset : page.offset + page.page_size]
    else:
        total = int((await db.exec(select(func.count()).select_from(base.subquery()))).one() or 0)
        rows_stmt = (
            base.order_by(ProductSpec.code.asc(), BlankPiece.size.asc(), BlankPiece.color.asc())
            .offset(page.offset)
            .limit(page.page_size)
        )
        page_rows = (await db.exec(rows_stmt)).all()

    # Compute in-production WIP for just the page's keys (one pair of grouped
    # queries), then net per row. Keys absent from the map are 0.
    keys = {(row[0].spec_id, row[0].color_code, row[0].size) for row in page_rows}
    in_production = await _in_production_map(db, company_id=company_id, keys=keys)

    rows: list[dict] = []
    for row in page_rows:
        piece: BlankPiece = row[0]
        spec: ProductSpec = row[1]
        on_hand = int(row[4] or 0)
        rows.append(
            {
                "blank_piece_id": piece.id,
                "spec_id": piece.spec_id,
                "spec": {"id": spec.id, "code": spec.code, "name": spec.name},
                "size": piece.size,
                "color": piece.color,
                "color_code": piece.color_code,
                "min_stock": piece.min_stock,
                "on_hand": on_hand,
                "in_production": in_production.get((piece.spec_id, piece.color_code, piece.size), 0),
                "low_stock": _is_low_stock(on_hand=on_hand, row_min_stock=piece.min_stock, threshold=threshold),
                "entries_total": int(row[2] or 0),
                "exits_total": int(row[3] or 0),
                "last_movement_at": row[5],
            }
        )
    return rows, total


# ---------- list_movements ----------


def _start_of_day(d) -> datetime:
    return datetime.combine(d, time.min)


def _end_of_day(d) -> datetime:
    return datetime.combine(d, time.max)


async def list_movements(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: BlankMovementFilters,
    page: PageParams,
) -> tuple[list[dict], int]:
    """The ledger, joined to its blank piece + spec, newest first."""

    base = (
        scoped(select(BlankPieceMovement, BlankPiece, ProductSpec), BlankPieceMovement, company_id)
        .join(BlankPiece, BlankPiece.id == BlankPieceMovement.blank_piece_id, isouter=True)
        .join(ProductSpec, ProductSpec.id == BlankPiece.spec_id, isouter=True)
    )

    if filters.blank_piece_id is not None:
        base = base.where(BlankPieceMovement.blank_piece_id == filters.blank_piece_id)
    if filters.kind is not None:
        base = base.where(cast(BlankPieceMovement.kind, String) == filters.kind.value)
    if filters.date_from is not None:
        base = base.where(BlankPieceMovement.created_at >= _start_of_day(filters.date_from))
    if filters.date_to is not None:
        base = base.where(BlankPieceMovement.created_at <= _end_of_day(filters.date_to))

    total = int((await db.exec(select(func.count()).select_from(base.subquery()))).one() or 0)

    rows_stmt = base.order_by(BlankPieceMovement.created_at.desc()).offset(page.offset).limit(page.page_size)
    result = await db.exec(rows_stmt)
    rows: list[dict] = []
    for movement, piece, spec in result.all():
        rows.append(
            {
                "id": movement.id,
                "blank_piece_id": movement.blank_piece_id,
                "blank_piece": None
                if piece is None
                else {
                    "id": piece.id,
                    "spec_code": spec.code if spec is not None else "",
                    "size": piece.size,
                    "color": piece.color,
                },
                "kind": movement.kind,
                "quantity": movement.quantity,
                "notes": movement.notes,
                "created_at": movement.created_at,
            }
        )
    return rows, total


# ---------- create_movement ----------


async def create_movement(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: BlankMovementCreate,
) -> BlankPieceMovement:
    piece = await _get_blank_piece(db, company_id=company_id, blank_piece_id=payload.blank_piece_id)

    if payload.kind == BlankMovementKind.EXIT:
        on_hand = await _compute_on_hand(db, company_id=company_id, blank_piece_id=piece.id)
        if on_hand < payload.quantity:
            raise ConflictError(detail=f"Insufficient blank pieces on-hand — available: {on_hand}")

    movement = BlankPieceMovement(
        company_id=company_id,
        blank_piece_id=piece.id,
        kind=payload.kind,
        quantity=payload.quantity,
        sewing_shipment_id=None,
        assembly_run_id=None,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(movement)
    await db.flush()

    sign = "-" if payload.kind == BlankMovementKind.EXIT else "+"
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_MOVEMENT_RESOURCE,
        resource_id=movement.id,
        message=(
            f"Blank piece movement for {piece.size.value}/{piece.color}: "
            f"{sign}{movement.quantity} ({movement.kind.value})"
        ),
    )
    await db.commit()
    await db.refresh(movement)
    return movement


# ---------- transition-internal helpers (no commit, provenance) ----------


async def get_or_create_blank_piece(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    spec_id: uuid.UUID,
    size: Size,
    color: str,
    color_code: str,
) -> BlankPiece:
    """Resolve the blank piece for ``(spec, size, color_code)``, creating it if absent.

    Used by the T3 sewing-receipt transition to land credited pieces on the
    right catalog row (the cutting order carries spec/color/color_code). Does
    NOT commit — the caller owns the transaction — but flushes the new row so
    its id is immediately usable for the movement provenance.
    """

    stmt = scoped(select(BlankPiece), BlankPiece, company_id).where(
        BlankPiece.spec_id == spec_id,
        BlankPiece.size == size,
        BlankPiece.color_code == color_code,
    )
    piece = (await db.exec(stmt)).first()
    if piece is not None:
        return piece

    piece = BlankPiece(
        company_id=company_id,
        spec_id=spec_id,
        size=size,
        color=color.strip(),
        color_code=color_code,
        min_stock=None,
    )
    db.add(piece)
    await db.flush()
    return piece


async def record_movement(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    blank_piece_id: uuid.UUID,
    kind: BlankMovementKind,
    quantity: int,
    sewing_shipment_id: uuid.UUID | None = None,
    assembly_run_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> BlankPieceMovement:
    """Append a blank-piece ledger row with provenance, WITHOUT committing.

    The transition-internal sibling of :func:`create_movement`: it reuses the
    same on-hand guard for EXIT (409 if insufficient — never clamp counted tiers)
    but does NOT commit (the caller — e.g. the T3 sewing-receipt or the T5
    assemble transition — owns the transaction) and does NOT write audit (the
    caller writes one transition-level entry). The sewing shipment (T3 credit) or
    assembly run (T5 debit) is recorded as provenance.
    """

    if kind == BlankMovementKind.EXIT:
        on_hand = await _compute_on_hand(db, company_id=company_id, blank_piece_id=blank_piece_id)
        if on_hand < quantity:
            raise ConflictError(detail=f"Insufficient blank pieces on-hand — available: {on_hand}")

    movement = BlankPieceMovement(
        company_id=company_id,
        blank_piece_id=blank_piece_id,
        kind=kind,
        quantity=quantity,
        sewing_shipment_id=sewing_shipment_id,
        assembly_run_id=assembly_run_id,
        notes=notes.strip() if notes else None,
    )
    db.add(movement)
    await db.flush()
    return movement


__all__ = [
    "_compute_on_hand",
    "compute_on_hand_map",
    "create_blank_piece",
    "create_movement",
    "get_or_create_blank_piece",
    "list_levels",
    "list_movements",
    "record_movement",
]
