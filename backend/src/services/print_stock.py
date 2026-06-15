"""Service layer for the Print Stock (estoque de estampas / impresso) feature.

Convention notes
----------------
- On-hand is computed live from `print_stock_movements`. There is no
  materialised balance column — the ledger stays strictly append-only.
- A single ledger table carries a `direction` enum; ENTRY and ADJUSTMENT
  credit stock, EXIT debits it (every row holds a strictly-positive
  `quantity`). This mirrors the finished-piece Stock feature but collapses
  its two tables into one, matching the legacy `AjusteEstampa` impresso ledger.
- The levels endpoint surfaces ONLY `(print_design, product_color)` pairs
  that have moved at least once.
- `product_color` is FREE-TEXT (matching `ProductVariation.color`) so callers
  can join the ledger by colour string. Do NOT normalise/lowercase it.
- `create_exit` enforces the no-negative-stock invariant by re-aggregating on
  the fly before writing. Racey under heavy concurrency — accepted for v1
  because exits happen at human-input pace.
- `compute_on_hand_map` is the netting source consumed by
  `services.batch._recompute_adjustments`.
"""

from __future__ import annotations

import uuid
from datetime import datetime, time

from sqlalchemy import String, case, cast, func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import PrintDesign, PrintStockDirection, PrintStockMovement
from schemas._common import PageParams
from schemas.print_stock import (
    PrintStockEntryCreate,
    PrintStockExitCreate,
    PrintStockLevelFilters,
    PrintStockMovementFilters,
)
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError

_RESOURCE = "print_stock_movements"

# ENTRY + ADJUSTMENT credit stock; EXIT debits it.
_CREDIT_DIRECTIONS = (PrintStockDirection.ENTRY, PrintStockDirection.ADJUSTMENT)

# A signed-quantity SQL expression: +quantity for credits, -quantity for exits.
_SIGNED_QTY = case(
    (PrintStockMovement.direction == PrintStockDirection.EXIT, -PrintStockMovement.quantity),
    else_=PrintStockMovement.quantity,
)


# ---------- helpers ----------


async def _get_design(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    print_design_id: uuid.UUID,
) -> PrintDesign:
    stmt = scoped(select(PrintDesign), PrintDesign, company_id).where(PrintDesign.id == print_design_id)
    design = (await db.exec(stmt)).first()
    if design is None:
        raise NotFoundError(detail="Print design not found")
    return design


async def _compute_on_hand(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    print_design_id: uuid.UUID,
    product_color: str,
) -> int:
    """Current on-hand for a single (design, colour) pair."""

    stmt = scoped(select(func.coalesce(func.sum(_SIGNED_QTY), 0)), PrintStockMovement, company_id).where(
        PrintStockMovement.print_design_id == print_design_id,
        PrintStockMovement.product_color == product_color,
    )
    return int((await db.exec(stmt)).first() or 0)


async def compute_on_hand_map(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
) -> dict[tuple[uuid.UUID, str], int]:
    """Return ``{(print_design_id, product_color): on_hand}`` for the tenant.

    Single bulk aggregation — used by the batch print-queue netting so it does
    not issue one query per adjustment row. Only pairs with a non-zero history
    are present; callers default missing keys to 0.
    """

    stmt = scoped(
        select(
            PrintStockMovement.print_design_id,
            PrintStockMovement.product_color,
            func.coalesce(func.sum(_SIGNED_QTY), 0).label("on_hand"),
        ),
        PrintStockMovement,
        company_id,
    ).group_by(PrintStockMovement.print_design_id, PrintStockMovement.product_color)
    result = await db.exec(stmt)
    return {(row[0], row[1]): int(row[2] or 0) for row in result.all()}


# ---------- list_levels ----------


async def list_levels(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: PrintStockLevelFilters,
    page: PageParams,
) -> tuple[list[dict], int]:
    """Paginated rows per ``(print_design, product_color)`` joined to the design.

    Only pairs with at least one movement are surfaced.
    """

    entries_sum = func.coalesce(
        func.sum(case((PrintStockMovement.direction.in_(_CREDIT_DIRECTIONS), PrintStockMovement.quantity), else_=0)),
        0,
    )
    exits_sum = func.coalesce(
        func.sum(
            case(
                (PrintStockMovement.direction == PrintStockDirection.EXIT, PrintStockMovement.quantity),
                else_=0,
            )
        ),
        0,
    )

    agg = (
        scoped(
            select(
                PrintStockMovement.print_design_id.label("print_design_id"),
                PrintStockMovement.product_color.label("product_color"),
                entries_sum.label("entries_total"),
                exits_sum.label("exits_total"),
                func.max(PrintStockMovement.created_at).label("last_movement_at"),
            ),
            PrintStockMovement,
            company_id,
        )
        .group_by(PrintStockMovement.print_design_id, PrintStockMovement.product_color)
        .subquery()
    )

    on_hand_expr = func.coalesce(agg.c.entries_total, 0) - func.coalesce(agg.c.exits_total, 0)

    base = select(
        PrintDesign,
        agg.c.product_color,
        func.coalesce(agg.c.entries_total, 0).label("entries_total"),
        func.coalesce(agg.c.exits_total, 0).label("exits_total"),
        on_hand_expr.label("on_hand"),
        agg.c.last_movement_at,
    ).join(PrintDesign, PrintDesign.id == agg.c.print_design_id)

    if filters.print_design_id is not None:
        base = base.where(agg.c.print_design_id == filters.print_design_id)
    if filters.product_color:
        base = base.where(func.lower(agg.c.product_color) == filters.product_color.strip().lower())
    if filters.q:
        like = f"%{filters.q.strip().lower()}%"
        base = base.where(
            or_(
                func.lower(PrintDesign.code).like(like),
                func.lower(PrintDesign.name).like(like),
                func.lower(agg.c.product_color).like(like),
            )
        )

    total = int((await db.exec(select(func.count()).select_from(base.subquery()))).one() or 0)

    rows_stmt = (
        base.order_by(PrintDesign.code.asc(), agg.c.product_color.asc()).offset(page.offset).limit(page.page_size)
    )
    result = await db.exec(rows_stmt)
    rows: list[dict] = []
    for row in result.all():
        design: PrintDesign = row[0]
        rows.append(
            {
                "print_design_id": design.id,
                "product_color": row[1],
                "design": {
                    "id": design.id,
                    "code": design.code,
                    "name": design.name,
                    "image_url": design.image_url,
                },
                "entries_total": int(row[2] or 0),
                "exits_total": int(row[3] or 0),
                "on_hand": int(row[4] or 0),
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
    filters: PrintStockMovementFilters,
    page: PageParams,
) -> tuple[list[dict], int]:
    """The ledger, joined to its print design, newest first."""

    base = scoped(select(PrintStockMovement, PrintDesign), PrintStockMovement, company_id).join(
        PrintDesign, PrintDesign.id == PrintStockMovement.print_design_id, isouter=True
    )

    if filters.print_design_id is not None:
        base = base.where(PrintStockMovement.print_design_id == filters.print_design_id)
    if filters.product_color:
        base = base.where(func.lower(PrintStockMovement.product_color) == filters.product_color.strip().lower())
    if filters.direction is not None:
        base = base.where(cast(PrintStockMovement.direction, String) == filters.direction.value)
    if filters.date_from is not None:
        base = base.where(PrintStockMovement.created_at >= _start_of_day(filters.date_from))
    if filters.date_to is not None:
        base = base.where(PrintStockMovement.created_at <= _end_of_day(filters.date_to))

    count_stmt = select(func.count()).select_from(base.subquery())
    total = int((await db.exec(count_stmt)).one() or 0)

    rows_stmt = base.order_by(PrintStockMovement.created_at.desc()).offset(page.offset).limit(page.page_size)
    result = await db.exec(rows_stmt)
    rows: list[dict] = []
    for movement, design in result.all():
        rows.append(
            {
                "id": movement.id,
                "print_design_id": movement.print_design_id,
                "product_color": movement.product_color,
                "design": None
                if design is None
                else {
                    "id": design.id,
                    "code": design.code,
                    "name": design.name,
                    "image_url": design.image_url,
                },
                "direction": movement.direction,
                "quantity": movement.quantity,
                "notes": movement.notes,
                "created_at": movement.created_at,
                "batch": {"id": movement.batch_id} if movement.batch_id else None,
            }
        )
    return rows, total


# ---------- create_entry ----------


async def create_entry(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    payload: PrintStockEntryCreate,
) -> PrintStockMovement:
    design = await _get_design(db, company_id=company_id, print_design_id=payload.print_design_id)
    color = payload.product_color.strip()

    movement = PrintStockMovement(
        company_id=company_id,
        print_design_id=design.id,
        product_color=color,
        direction=PrintStockDirection.ENTRY,
        quantity=payload.quantity,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(movement)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=movement.id,
        message=f"Print stock for {design.code}/{color}: +{movement.quantity} (entry)",
    )
    await db.commit()
    await db.refresh(movement)
    return movement


# ---------- create_exit ----------


async def create_exit(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    payload: PrintStockExitCreate,
) -> PrintStockMovement:
    design = await _get_design(db, company_id=company_id, print_design_id=payload.print_design_id)
    color = payload.product_color.strip()

    on_hand = await _compute_on_hand(
        db,
        company_id=company_id,
        print_design_id=design.id,
        product_color=color,
    )
    if on_hand < payload.quantity:
        raise ConflictError(detail=f"Insufficient print stock — available: {on_hand}")

    movement = PrintStockMovement(
        company_id=company_id,
        print_design_id=design.id,
        product_color=color,
        direction=PrintStockDirection.EXIT,
        quantity=payload.quantity,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(movement)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=movement.id,
        message=f"Print stock for {design.code}/{color}: -{movement.quantity} (exit)",
    )
    await db.commit()
    await db.refresh(movement)
    return movement


__all__ = [
    "compute_on_hand_map",
    "create_entry",
    "create_exit",
    "list_levels",
    "list_movements",
]
