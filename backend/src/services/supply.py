"""Service layer for the Consumables / supply inventory (insumos) feature.

Convention notes
----------------
- A ``Supply`` is a plain tenant-scoped CRUD catalog (mirrors ``services.fabric``):
  ``list`` / ``get`` / ``create`` / ``update`` / ``delete`` with a ``q`` search.
- On-hand is computed live from the append-only ``supply_movements`` ledger —
  there is NO materialised balance column. A single table carries a ``kind``
  enum; ENTRY and ADJUSTMENT credit stock, EXIT debits it (every row holds a
  strictly-positive ``quantity``). This mirrors the finished-piece Stock /
  Print-stock ledgers but uses Decimal quantities (fractional units: m, kg, L).
- ``list_supply_levels`` surfaces ONE row per supply (a supply with zero
  movements still appears, with on-hand 0 — unlike the variation-stock list,
  because the supply catalog is the source of truth here).
- ``create_movement`` enforces the no-negative-on-hand invariant for EXIT by
  re-aggregating on the fly before writing (racey under heavy concurrency;
  accepted for v1 since movements happen at human-input pace).
- ``delete_supply`` is blocked when any ledger row references the supply
  (``ConflictError``) — the FK is ``ondelete=RESTRICT`` so the catalog stays
  consistent with its history.
- Every SELECT is tenant-scoped via :func:`scoped`; mutations write a single
  audit entry under ``supplies`` / ``supply_movements``.
"""

from __future__ import annotations

import uuid
from datetime import datetime, time
from decimal import Decimal

from sqlalchemy import String, case, cast, func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Supply, SupplyMovement, SupplyMovementKind
from schemas._common import PageParams
from schemas.supply import (
    SupplyCreate,
    SupplyFilters,
    SupplyLevelFilters,
    SupplyMovementCreate,
    SupplyMovementFilters,
    SupplyUpdate,
)
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError

_RESOURCE = "supplies"
_MOVEMENT_RESOURCE = "supply_movements"

# ENTRY + ADJUSTMENT credit stock; EXIT debits it.
_CREDIT_KINDS = (SupplyMovementKind.ENTRY, SupplyMovementKind.ADJUSTMENT)

# A signed-quantity SQL expression: +quantity for credits, -quantity for exits.
_SIGNED_QTY = case(
    (SupplyMovement.kind == SupplyMovementKind.EXIT, -SupplyMovement.quantity),
    else_=SupplyMovement.quantity,
)


# ---------- helpers ----------


async def _get_supply(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    supply_id: uuid.UUID,
) -> Supply:
    stmt = scoped(select(Supply), Supply, company_id).where(Supply.id == supply_id)
    supply = (await db.exec(stmt)).first()
    if supply is None:
        raise NotFoundError(detail="Supply not found")
    return supply


async def _compute_on_hand(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    supply_id: uuid.UUID,
) -> Decimal:
    """Current on-hand for a single supply (signed sum of ledger rows)."""

    stmt = scoped(select(func.coalesce(func.sum(_SIGNED_QTY), 0)), SupplyMovement, company_id).where(
        SupplyMovement.supply_id == supply_id
    )
    return Decimal((await db.exec(stmt)).first() or 0)


# ---------- catalog CRUD ----------


async def list_supplies(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: SupplyFilters,
    page: PageParams,
) -> tuple[list[Supply], int]:
    base = scoped(select(Supply), Supply, company_id)
    if filters.q:
        like = f"%{filters.q.strip().lower()}%"
        base = base.where(
            or_(
                func.lower(Supply.name).like(like),
                func.lower(Supply.unit).like(like),
            )
        )

    total = int((await db.exec(select(func.count()).select_from(base.subquery()))).one() or 0)

    items_stmt = (
        base.order_by(Supply.name.asc()).offset(page.offset).limit(page.page_size)  # type: ignore[attr-defined]
    )
    items = list((await db.exec(items_stmt)).all())
    return items, total


async def get_supply(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    supply_id: uuid.UUID,
) -> Supply:
    return await _get_supply(db, company_id=company_id, supply_id=supply_id)


async def create_supply(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: SupplyCreate,
) -> Supply:
    supply = Supply(
        company_id=company_id,
        name=payload.name.strip(),
        unit=payload.unit.strip(),
        unit_cost=payload.unit_cost,
        min_stock=payload.min_stock,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(supply)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=supply.id,
        message=f"Supply created: {supply.name} ({supply.unit})",
    )
    await db.commit()
    await db.refresh(supply)
    return supply


async def update_supply(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    supply_id: uuid.UUID,
    payload: SupplyUpdate,
) -> Supply:
    supply = await _get_supply(db, company_id=company_id, supply_id=supply_id)
    data = payload.model_dump(exclude_unset=True)

    if "name" in data and data["name"] is not None:
        supply.name = data["name"].strip()
    if "unit" in data and data["unit"] is not None:
        supply.unit = data["unit"].strip()
    if "unit_cost" in data and data["unit_cost"] is not None:
        supply.unit_cost = data["unit_cost"]
    # `min_stock` and `notes` are nullable — an explicit null clears them.
    if "min_stock" in data:
        supply.min_stock = data["min_stock"]
    if "notes" in data:
        supply.notes = data["notes"].strip() if data["notes"] else None

    db.add(supply)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=supply.id,
        message=f"Supply updated: {supply.name} ({supply.unit})",
    )
    await db.commit()
    await db.refresh(supply)
    return supply


async def _assert_no_movements(db: AsyncSession, *, company_id: uuid.UUID, supply_id: uuid.UUID) -> None:
    stmt = scoped(select(func.count()), SupplyMovement, company_id).where(SupplyMovement.supply_id == supply_id)
    if int((await db.exec(stmt)).first() or 0) > 0:
        raise ConflictError(detail="Cannot delete supply — it has stock movements")


async def delete_supply(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    supply_id: uuid.UUID,
) -> None:
    supply = await _get_supply(db, company_id=company_id, supply_id=supply_id)
    await _assert_no_movements(db, company_id=company_id, supply_id=supply.id)

    label = f"{supply.name} ({supply.unit})"
    await db.delete(supply)
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=supply.id,
        message=f"Supply deleted: {label}",
    )
    await db.commit()


# ---------- list_supply_levels ----------


async def list_supply_levels(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: SupplyLevelFilters,
    page: PageParams,
) -> tuple[list[dict], int]:
    """Paginated rows of ``(supply, on_hand, entries_total, exits_total, last_movement_at)``.

    Every supply in the catalog is surfaced (on-hand 0 when it has no
    movements) so the catalog stays the source of truth for the levels view.
    """

    entries_sum = func.coalesce(
        func.sum(case((SupplyMovement.kind.in_(_CREDIT_KINDS), SupplyMovement.quantity), else_=0)), 0
    )
    exits_sum = func.coalesce(
        func.sum(case((SupplyMovement.kind == SupplyMovementKind.EXIT, SupplyMovement.quantity), else_=0)), 0
    )

    agg = (
        scoped(
            select(
                SupplyMovement.supply_id.label("supply_id"),
                entries_sum.label("entries_total"),
                exits_sum.label("exits_total"),
                func.max(SupplyMovement.created_at).label("last_movement_at"),
            ),
            SupplyMovement,
            company_id,
        )
        .group_by(SupplyMovement.supply_id)
        .subquery()
    )

    entries_total_expr = func.coalesce(agg.c.entries_total, 0)
    exits_total_expr = func.coalesce(agg.c.exits_total, 0)
    on_hand_expr = entries_total_expr - exits_total_expr

    base = (
        select(
            Supply,
            entries_total_expr.label("entries_total"),
            exits_total_expr.label("exits_total"),
            on_hand_expr.label("on_hand"),
            agg.c.last_movement_at,
        )
        .outerjoin(agg, agg.c.supply_id == Supply.id)
        .where(Supply.company_id == company_id)
    )

    if filters.q:
        like = f"%{filters.q.strip().lower()}%"
        base = base.where(
            or_(
                func.lower(Supply.name).like(like),
                func.lower(Supply.unit).like(like),
            )
        )
    if filters.low_stock_only:
        # Only supplies with a configured threshold can be "low".
        base = base.where(Supply.min_stock.is_not(None)).where(on_hand_expr <= Supply.min_stock)

    total = int((await db.exec(select(func.count()).select_from(base.subquery()))).one() or 0)

    rows_stmt = base.order_by(Supply.name.asc()).offset(page.offset).limit(page.page_size)
    result = await db.exec(rows_stmt)
    rows: list[dict] = []
    for row in result.all():
        supply: Supply = row[0]
        rows.append(
            {
                "supply_id": supply.id,
                "name": supply.name,
                "unit": supply.unit,
                "unit_cost": supply.unit_cost,
                "min_stock": supply.min_stock,
                "entries_total": Decimal(row[1] or 0),
                "exits_total": Decimal(row[2] or 0),
                "on_hand": Decimal(row[3] or 0),
                "last_movement_at": row[4],
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
    filters: SupplyMovementFilters,
    page: PageParams,
) -> tuple[list[dict], int]:
    """The ledger, joined to its supply, newest first."""

    base = scoped(select(SupplyMovement, Supply), SupplyMovement, company_id).join(
        Supply, Supply.id == SupplyMovement.supply_id, isouter=True
    )

    if filters.supply_id is not None:
        base = base.where(SupplyMovement.supply_id == filters.supply_id)
    if filters.kind is not None:
        base = base.where(cast(SupplyMovement.kind, String) == filters.kind.value)
    if filters.date_from is not None:
        base = base.where(SupplyMovement.created_at >= _start_of_day(filters.date_from))
    if filters.date_to is not None:
        base = base.where(SupplyMovement.created_at <= _end_of_day(filters.date_to))

    total = int((await db.exec(select(func.count()).select_from(base.subquery()))).one() or 0)

    rows_stmt = base.order_by(SupplyMovement.created_at.desc()).offset(page.offset).limit(page.page_size)
    result = await db.exec(rows_stmt)
    rows: list[dict] = []
    for movement, supply in result.all():
        rows.append(
            {
                "id": movement.id,
                "supply_id": movement.supply_id,
                "supply": None if supply is None else {"id": supply.id, "name": supply.name, "unit": supply.unit},
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
    payload: SupplyMovementCreate,
) -> SupplyMovement:
    supply = await _get_supply(db, company_id=company_id, supply_id=payload.supply_id)

    if payload.kind == SupplyMovementKind.EXIT:
        on_hand = await _compute_on_hand(db, company_id=company_id, supply_id=supply.id)
        if on_hand < payload.quantity:
            raise ConflictError(detail=f"Insufficient supply on-hand — available: {on_hand}")

    movement = SupplyMovement(
        company_id=company_id,
        supply_id=supply.id,
        kind=payload.kind,
        quantity=payload.quantity,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(movement)
    await db.flush()

    sign = "-" if payload.kind == SupplyMovementKind.EXIT else "+"
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_MOVEMENT_RESOURCE,
        resource_id=movement.id,
        message=f"Supply movement for {supply.name}: {sign}{movement.quantity} ({movement.kind.value})",
    )
    await db.commit()
    await db.refresh(movement)
    return movement


__all__ = [
    "create_movement",
    "create_supply",
    "delete_supply",
    "get_supply",
    "list_movements",
    "list_supplies",
    "list_supply_levels",
    "update_supply",
]
