"""Service layer for the Stock (estoque) feature.

Convention notes
----------------
- Stock-on-hand is computed live from `stock_entries` - `stock_exits`. There
  is no materialised balance column — that lets the ledger stay strictly
  append-only and removes any "drift" failure modes.
- The list endpoint joins the two aggregates per variation and surfaces ONLY
  variations that have at least one entry OR exit (everything else has
  zero history and would just bloat the table).
- `create_entry` and `create_exit` write a single row + a single audit
  entry under the `stock_entries` / `stock_exits` resource types.
- `create_exit` enforces the no-negative-stock invariant by re-aggregating
  on the fly before writing. The check is racey under heavy concurrency
  — for v1 we accept that because exits happen at human-input pace.
"""

from __future__ import annotations

import uuid
from datetime import datetime, time

from sqlalchemy import String, cast, func, literal, or_, union_all
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Product, ProductVariation, StockEntry, StockExit
from schemas._common import PageParams
from schemas.stock import (
    MovementsFilters,
    StockEntryCreate,
    StockExitCreate,
    StockFilters,
    StockMovementEntry,
    StockMovementExit,
    StockMovementRead,
    StockOrderMini,
)
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError

_ENTRY_RESOURCE = "stock_entries"
_EXIT_RESOURCE = "stock_exits"


# ---------- helpers ----------


async def _get_variation(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    variation_id: uuid.UUID,
) -> ProductVariation:
    stmt = scoped(select(ProductVariation), ProductVariation, company_id).where(ProductVariation.id == variation_id)
    result = await db.exec(stmt)
    variation = result.first()
    if variation is None:
        raise NotFoundError(detail="Product variation not found")
    return variation


async def _compute_on_hand(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    variation_id: uuid.UUID,
) -> int:
    """Return the current on-hand quantity for a single variation.

    `coalesce(sum(quantity), 0)` because empty ledgers yield NULL otherwise.
    """

    entries_stmt = scoped(select(func.coalesce(func.sum(StockEntry.quantity), 0)), StockEntry, company_id).where(
        StockEntry.variation_id == variation_id
    )
    exits_stmt = scoped(select(func.coalesce(func.sum(StockExit.quantity), 0)), StockExit, company_id).where(
        StockExit.variation_id == variation_id
    )
    entries_total = int((await db.exec(entries_stmt)).first() or 0)
    exits_total = int((await db.exec(exits_stmt)).first() or 0)
    return entries_total - exits_total


# ---------- list_stock_levels ----------


async def list_stock_levels(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: StockFilters,
    page: PageParams,
) -> tuple[list[dict], int]:
    """Return paginated rows of `(variation, product, on_hand, entries_total, exits_total, last_movement_at)`.

    Only variations with at least one entry OR exit are surfaced — empty
    ledgers don't need to clutter the list. Filters operate on the joined
    row, not the raw ledger.
    """

    entries_agg = (
        select(
            StockEntry.variation_id.label("variation_id"),
            func.coalesce(func.sum(StockEntry.quantity), 0).label("entries_total"),
            func.max(StockEntry.created_at).label("last_entry_at"),
        )
        .where(StockEntry.company_id == company_id)
        .group_by(StockEntry.variation_id)
        .subquery()
    )
    exits_agg = (
        select(
            StockExit.variation_id.label("variation_id"),
            func.coalesce(func.sum(StockExit.quantity), 0).label("exits_total"),
            func.max(StockExit.created_at).label("last_exit_at"),
        )
        .where(StockExit.company_id == company_id)
        .group_by(StockExit.variation_id)
        .subquery()
    )

    on_hand_expr = func.coalesce(entries_agg.c.entries_total, 0) - func.coalesce(exits_agg.c.exits_total, 0)
    last_move_expr = func.greatest(
        func.coalesce(entries_agg.c.last_entry_at, exits_agg.c.last_exit_at),
        func.coalesce(exits_agg.c.last_exit_at, entries_agg.c.last_entry_at),
    )

    base = (
        select(
            ProductVariation,
            Product,
            func.coalesce(entries_agg.c.entries_total, 0).label("entries_total"),
            func.coalesce(exits_agg.c.exits_total, 0).label("exits_total"),
            on_hand_expr.label("on_hand"),
            last_move_expr.label("last_movement_at"),
        )
        .join(Product, Product.id == ProductVariation.product_id)
        .outerjoin(entries_agg, entries_agg.c.variation_id == ProductVariation.id)
        .outerjoin(exits_agg, exits_agg.c.variation_id == ProductVariation.id)
        .where(ProductVariation.company_id == company_id)
        # Only surface variations that have moved at least once.
        .where(or_(entries_agg.c.variation_id.is_not(None), exits_agg.c.variation_id.is_not(None)))
    )

    if filters.product_id is not None:
        base = base.where(ProductVariation.product_id == filters.product_id)
    if filters.q:
        needle = filters.q.strip().lower()
        like = f"%{needle}%"
        base = base.where(
            or_(
                func.lower(ProductVariation.sku).like(like),
                func.lower(ProductVariation.color).like(like),
                func.lower(Product.name).like(like),
            )
        )
    if filters.low_stock_only:
        base = base.where(on_hand_expr <= filters.threshold)

    # Count first — slicing destroys the labeled columns.
    total_result = await db.exec(select(func.count()).select_from(base.subquery()))
    total = int(total_result.one() or 0)

    rows_stmt = base.order_by(ProductVariation.sku.asc()).offset(page.offset).limit(page.page_size)
    result = await db.exec(rows_stmt)
    rows = []
    for row in result.all():
        variation: ProductVariation = row[0]
        product: Product = row[1]
        entries_total = int(row[2] or 0)
        exits_total = int(row[3] or 0)
        on_hand = int(row[4] or 0)
        last_movement_at = row[5]
        rows.append(
            {
                "variation_id": variation.id,
                "sku": variation.sku,
                "size": variation.size,
                "color": variation.color,
                "color_code": variation.color_code,
                "product": {
                    "id": product.id,
                    "name": product.name,
                    "code": str(product.id)[:8],
                },
                "on_hand": on_hand,
                "entries_total": entries_total,
                "exits_total": exits_total,
                "last_movement_at": last_movement_at,
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
    filters: MovementsFilters,
    page: PageParams,
) -> tuple[list[StockMovementRead], int]:
    """Return the interleaved ledger, sorted by `created_at DESC`.

    Built via two parallel queries + Python interleave rather than a SQL
    UNION because the column shapes differ (entries have `source` while exits
    have `reason`/`order_id`). A union query would need column aliasing and
    casting that's gnarlier than just joining + sorting in code.
    """

    entry_stmt = (
        select(StockEntry, ProductVariation.sku)
        .join(ProductVariation, ProductVariation.id == StockEntry.variation_id)
        .where(StockEntry.company_id == company_id)
    )
    exit_stmt = (
        select(StockExit, ProductVariation.sku)
        .join(ProductVariation, ProductVariation.id == StockExit.variation_id)
        .where(StockExit.company_id == company_id)
    )

    if filters.variation_id is not None:
        entry_stmt = entry_stmt.where(StockEntry.variation_id == filters.variation_id)
        exit_stmt = exit_stmt.where(StockExit.variation_id == filters.variation_id)
    if filters.date_from is not None:
        bound = _start_of_day(filters.date_from)
        entry_stmt = entry_stmt.where(StockEntry.created_at >= bound)
        exit_stmt = exit_stmt.where(StockExit.created_at >= bound)
    if filters.date_to is not None:
        bound = _end_of_day(filters.date_to)
        entry_stmt = entry_stmt.where(StockEntry.created_at <= bound)
        exit_stmt = exit_stmt.where(StockExit.created_at <= bound)
    if filters.reason_or_source is not None:
        value = filters.reason_or_source.strip().lower()
        # Match the raw enum value on either side; only one half matches
        # for a given row but the OR composes cleanly.
        entry_stmt = entry_stmt.where(func.lower(cast(StockEntry.source, String)) == value)
        exit_stmt = exit_stmt.where(func.lower(cast(StockExit.reason, String)) == value)

    movements: list[StockMovementRead] = []
    if filters.type != "exit":
        result = await db.exec(entry_stmt)
        for entry, sku in result.all():
            movements.append(
                StockMovementEntry(
                    id=entry.id,
                    variation_id=entry.variation_id,
                    sku=sku,
                    source=entry.source,
                    quantity=entry.quantity,
                    notes=entry.notes,
                    created_at=entry.created_at,
                )
            )
    if filters.type != "entry":
        result = await db.exec(exit_stmt)
        for exit_row, sku in result.all():
            movements.append(
                StockMovementExit(
                    id=exit_row.id,
                    variation_id=exit_row.variation_id,
                    sku=sku,
                    reason=exit_row.reason,
                    quantity=exit_row.quantity,
                    notes=exit_row.notes,
                    created_at=exit_row.created_at,
                    order=None if exit_row.order_id is None else StockOrderMini(id=exit_row.order_id),
                )
            )

    movements.sort(key=lambda m: m.created_at, reverse=True)
    total = len(movements)
    offset = page.offset
    return movements[offset : offset + page.page_size], total


# ---------- create_entry ----------


async def create_entry(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: StockEntryCreate,
) -> StockEntry:
    variation = await _get_variation(db, company_id=company_id, variation_id=payload.variation_id)

    entry = StockEntry(
        company_id=company_id,
        variation_id=variation.id,
        quantity=payload.quantity,
        source=payload.source,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(entry)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_ENTRY_RESOURCE,
        resource_id=entry.id,
        message=(f"Adjusted stock for SKU {variation.sku}: +{entry.quantity} ({entry.source.value})"),
    )
    await db.commit()
    await db.refresh(entry)
    return entry


# ---------- create_exit ----------


async def create_exit(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: StockExitCreate,
) -> StockExit:
    variation = await _get_variation(db, company_id=company_id, variation_id=payload.variation_id)
    on_hand = await _compute_on_hand(db, company_id=company_id, variation_id=variation.id)
    if on_hand < payload.quantity:
        raise ConflictError(
            detail=f"Insufficient stock — available: {on_hand}",
        )

    exit_row = StockExit(
        company_id=company_id,
        variation_id=variation.id,
        order_id=None,
        quantity=payload.quantity,
        reason=payload.reason,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(exit_row)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_EXIT_RESOURCE,
        resource_id=exit_row.id,
        message=(f"Adjusted stock for SKU {variation.sku}: -{exit_row.quantity} ({exit_row.reason.value})"),
    )
    await db.commit()
    await db.refresh(exit_row)
    return exit_row


__all__ = [
    "create_entry",
    "create_exit",
    "list_movements",
    "list_stock_levels",
]


# Re-export so test utilities can import the canonical enum types alongside the service.
_ = (literal, union_all)
