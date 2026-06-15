"""Service layer for the Printed Transfers (estampados) WIP inventory tier.

Replaces the old ``print_stock`` service. A ``PrintedTransfer`` is keyed by
``(print_design_id, side)`` via a real FK (not the old free-text
``product_color``).

Convention notes
----------------
- On-hand is computed live from the append-only ``printed_transfer_movements``
  ledger — there is NO materialised balance column. A single table carries a
  ``kind`` enum; ENTRY and ADJUSTMENT credit stock, EXIT debits it (every row
  holds a strictly-positive ``quantity``). Mirrors ``services.supply``.
- ``list_levels`` surfaces ONE row per printed transfer (a row with zero
  movements still appears, with on-hand 0) so the catalog stays the source of
  truth — unlike the old ``print_stock`` levels which only surfaced moved pairs.
- ``low_stock`` is computed per row from the row-level ``min_stock`` if set,
  else the company-wide ``stockThresholds["printed"]`` (absolute count compare).
- ``create_movement`` enforces the no-negative-on-hand invariant for EXIT.
  ``create_printed_transfer`` lets a new ``(design, side)`` key be created.
- ``compute_on_hand_map`` is the bulk netting source consumed by downstream
  transitions (Assembly P4, Lotes P6) — keyed by ``printed_transfer_id``.
- Every SELECT is tenant-scoped via :func:`scoped`; mutations write a single
  audit entry under ``printed_transfers`` / ``printed_transfer_movements``.
"""

from __future__ import annotations

import uuid
from datetime import datetime, time
from typing import Any

from sqlalchemy import String, case, cast, func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import PrintDesign, PrintedMovementKind, PrintedTransfer, PrintedTransferMovement
from schemas._common import PageParams
from schemas.printed_transfer import (
    PrintedMovementCreate,
    PrintedMovementFilters,
    PrintedTransferCreate,
    PrintedTransferLevelFilters,
)
from services import company_settings as settings_service
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError

_RESOURCE = "printed_transfers"
_MOVEMENT_RESOURCE = "printed_transfer_movements"
_THRESHOLD_KEY = "printed"

# ENTRY + ADJUSTMENT credit stock; EXIT debits it.
_CREDIT_KINDS = (PrintedMovementKind.ENTRY, PrintedMovementKind.ADJUSTMENT)

# A signed-quantity SQL expression: +quantity for credits, -quantity for exits.
_SIGNED_QTY = case(
    (PrintedTransferMovement.kind == PrintedMovementKind.EXIT, -PrintedTransferMovement.quantity),
    else_=PrintedTransferMovement.quantity,
)


# ---------- helpers ----------


async def _get_printed_transfer(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    printed_transfer_id: uuid.UUID,
) -> PrintedTransfer:
    stmt = scoped(select(PrintedTransfer), PrintedTransfer, company_id).where(PrintedTransfer.id == printed_transfer_id)
    transfer = (await db.exec(stmt)).first()
    if transfer is None:
        raise NotFoundError(detail="Printed transfer not found")
    return transfer


async def _compute_on_hand(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    printed_transfer_id: uuid.UUID,
) -> int:
    """Current on-hand for a single printed transfer (signed sum of ledger rows)."""

    stmt = scoped(select(func.coalesce(func.sum(_SIGNED_QTY), 0)), PrintedTransferMovement, company_id).where(
        PrintedTransferMovement.printed_transfer_id == printed_transfer_id
    )
    return int((await db.exec(stmt)).first() or 0)


async def compute_on_hand_map(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
) -> dict[uuid.UUID, int]:
    """Return ``{printed_transfer_id: on_hand}`` for the tenant (bulk netting).

    Single aggregation — used by downstream consumers (Assembly P4, Lotes P6)
    so they don't issue one query per transfer. Only transfers with a non-zero
    history are present; callers default missing keys to 0.
    """

    stmt = scoped(
        select(
            PrintedTransferMovement.printed_transfer_id,
            func.coalesce(func.sum(_SIGNED_QTY), 0).label("on_hand"),
        ),
        PrintedTransferMovement,
        company_id,
    ).group_by(PrintedTransferMovement.printed_transfer_id)
    result = await db.exec(stmt)
    return {row[0]: int(row[1] or 0) for row in result.all()}


def _is_low_stock(*, on_hand: int, row_min_stock: int | None, threshold: dict[str, Any] | None) -> bool:
    """Counted-tier low-stock rule: row ``min_stock`` if set, else config value."""

    if row_min_stock is not None:
        return on_hand <= row_min_stock
    if threshold and threshold.get("enabled") and threshold.get("value") is not None:
        return on_hand <= int(threshold["value"])
    return False


# ---------- catalog create ----------


async def create_printed_transfer(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: PrintedTransferCreate,
) -> PrintedTransfer:
    """Create an empty printed-transfer catalog row (so the move sheet can target a new key)."""

    design_stmt = scoped(select(PrintDesign), PrintDesign, company_id).where(PrintDesign.id == payload.print_design_id)
    if (await db.exec(design_stmt)).first() is None:
        raise NotFoundError(detail="Print design not found")

    existing_stmt = scoped(select(PrintedTransfer), PrintedTransfer, company_id).where(
        PrintedTransfer.print_design_id == payload.print_design_id,
        PrintedTransfer.side == payload.side,
    )
    if (await db.exec(existing_stmt)).first() is not None:
        raise ConflictError(detail="Printed transfer already exists for this design/side")

    transfer = PrintedTransfer(
        company_id=company_id,
        print_design_id=payload.print_design_id,
        side=payload.side,
        min_stock=payload.min_stock,
    )
    db.add(transfer)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=transfer.id,
        message=f"Printed transfer created: design {transfer.print_design_id}/{transfer.side.value}",
    )
    await db.commit()
    await db.refresh(transfer)
    return transfer


# ---------- list_levels ----------


async def list_levels(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: PrintedTransferLevelFilters,
    page: PageParams,
) -> tuple[list[dict], int]:
    """Paginated rows of ``(printed_transfer, design, on_hand, entries/exits totals)``.

    Every printed transfer in the catalog is surfaced (on-hand 0 when it has no
    movements). ``low_stock`` is computed in Python per row (config threshold
    lives in JSONB).
    """

    entries_sum = func.coalesce(
        func.sum(case((PrintedTransferMovement.kind.in_(_CREDIT_KINDS), PrintedTransferMovement.quantity), else_=0)),
        0,
    )
    exits_sum = func.coalesce(
        func.sum(
            case(
                (PrintedTransferMovement.kind == PrintedMovementKind.EXIT, PrintedTransferMovement.quantity),
                else_=0,
            )
        ),
        0,
    )

    agg = (
        scoped(
            select(
                PrintedTransferMovement.printed_transfer_id.label("printed_transfer_id"),
                entries_sum.label("entries_total"),
                exits_sum.label("exits_total"),
                func.max(PrintedTransferMovement.created_at).label("last_movement_at"),
            ),
            PrintedTransferMovement,
            company_id,
        )
        .group_by(PrintedTransferMovement.printed_transfer_id)
        .subquery()
    )

    entries_total_expr = func.coalesce(agg.c.entries_total, 0)
    exits_total_expr = func.coalesce(agg.c.exits_total, 0)
    on_hand_expr = entries_total_expr - exits_total_expr

    base = (
        select(
            PrintedTransfer,
            PrintDesign,
            entries_total_expr.label("entries_total"),
            exits_total_expr.label("exits_total"),
            on_hand_expr.label("on_hand"),
            agg.c.last_movement_at,
        )
        .join(PrintDesign, PrintDesign.id == PrintedTransfer.print_design_id)
        .outerjoin(agg, agg.c.printed_transfer_id == PrintedTransfer.id)
        .where(PrintedTransfer.company_id == company_id)
    )

    if filters.print_design_id is not None:
        base = base.where(PrintedTransfer.print_design_id == filters.print_design_id)
    if filters.side is not None:
        base = base.where(PrintedTransfer.side == filters.side)
    if filters.q:
        like = f"%{filters.q.strip().lower()}%"
        base = base.where(
            or_(
                func.lower(PrintDesign.code).like(like),
                func.lower(PrintDesign.name).like(like),
            )
        )

    settings = await settings_service.get_settings(db, company_id=company_id)
    threshold = settings.config.get("stockThresholds", {}).get(_THRESHOLD_KEY)

    if filters.low_stock_only:
        rows_stmt = base.order_by(PrintDesign.code.asc(), PrintedTransfer.side.asc())
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
            base.order_by(PrintDesign.code.asc(), PrintedTransfer.side.asc()).offset(page.offset).limit(page.page_size)
        )
        page_rows = (await db.exec(rows_stmt)).all()

    rows: list[dict] = []
    for row in page_rows:
        transfer: PrintedTransfer = row[0]
        design: PrintDesign = row[1]
        on_hand = int(row[4] or 0)
        rows.append(
            {
                "printed_transfer_id": transfer.id,
                "print_design_id": transfer.print_design_id,
                "design": {
                    "id": design.id,
                    "code": design.code,
                    "name": design.name,
                    "image_url": design.image_url,
                },
                "side": transfer.side,
                "min_stock": transfer.min_stock,
                "on_hand": on_hand,
                "in_production": 0,
                "low_stock": _is_low_stock(on_hand=on_hand, row_min_stock=transfer.min_stock, threshold=threshold),
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
    filters: PrintedMovementFilters,
    page: PageParams,
) -> tuple[list[dict], int]:
    """The ledger, joined to its printed transfer + design, newest first."""

    base = (
        scoped(select(PrintedTransferMovement, PrintedTransfer, PrintDesign), PrintedTransferMovement, company_id)
        .join(PrintedTransfer, PrintedTransfer.id == PrintedTransferMovement.printed_transfer_id, isouter=True)
        .join(PrintDesign, PrintDesign.id == PrintedTransfer.print_design_id, isouter=True)
    )

    if filters.printed_transfer_id is not None:
        base = base.where(PrintedTransferMovement.printed_transfer_id == filters.printed_transfer_id)
    if filters.print_design_id is not None:
        base = base.where(PrintedTransfer.print_design_id == filters.print_design_id)
    if filters.side is not None:
        base = base.where(PrintedTransfer.side == filters.side)
    if filters.kind is not None:
        base = base.where(cast(PrintedTransferMovement.kind, String) == filters.kind.value)
    if filters.date_from is not None:
        base = base.where(PrintedTransferMovement.created_at >= _start_of_day(filters.date_from))
    if filters.date_to is not None:
        base = base.where(PrintedTransferMovement.created_at <= _end_of_day(filters.date_to))

    total = int((await db.exec(select(func.count()).select_from(base.subquery()))).one() or 0)

    rows_stmt = base.order_by(PrintedTransferMovement.created_at.desc()).offset(page.offset).limit(page.page_size)
    result = await db.exec(rows_stmt)
    rows: list[dict] = []
    for movement, transfer, design in result.all():
        rows.append(
            {
                "id": movement.id,
                "printed_transfer_id": movement.printed_transfer_id,
                "design": None
                if design is None
                else {
                    "id": design.id,
                    "code": design.code,
                    "name": design.name,
                    "image_url": design.image_url,
                },
                "side": transfer.side if transfer is not None else None,
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
    payload: PrintedMovementCreate,
) -> PrintedTransferMovement:
    transfer = await _get_printed_transfer(db, company_id=company_id, printed_transfer_id=payload.printed_transfer_id)

    if payload.kind == PrintedMovementKind.EXIT:
        on_hand = await _compute_on_hand(db, company_id=company_id, printed_transfer_id=transfer.id)
        if on_hand < payload.quantity:
            raise ConflictError(detail=f"Insufficient printed transfers on-hand — available: {on_hand}")

    movement = PrintedTransferMovement(
        company_id=company_id,
        printed_transfer_id=transfer.id,
        kind=payload.kind,
        quantity=payload.quantity,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(movement)
    await db.flush()

    sign = "-" if payload.kind == PrintedMovementKind.EXIT else "+"
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_MOVEMENT_RESOURCE,
        resource_id=movement.id,
        message=(
            f"Printed transfer movement for design {transfer.print_design_id}/{transfer.side.value}: "
            f"{sign}{movement.quantity} ({movement.kind.value})"
        ),
    )
    await db.commit()
    await db.refresh(movement)
    return movement


__all__ = [
    "_compute_on_hand",
    "compute_on_hand_map",
    "create_movement",
    "create_printed_transfer",
    "list_levels",
    "list_movements",
]
