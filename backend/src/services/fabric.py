"""Service layer for the Fabric (bobinas) feature.

Convention notes
----------------
- Tenant scoping is enforced via :func:`scoped` on every read.
- ``company_id`` is set explicitly on every insert.
- Mutations write a single audit entry under the ``fabric_rolls`` resource type.
- ``create_fabric_roll`` defaults ``current_weight_kg`` to ``initial_weight_kg``
  when the caller omits it (an incoming roll has been fully consumed
  exactly zero times).
- ``current_weight_kg`` is invariant-guarded everywhere: it must always satisfy
  ``0 <= current <= initial``. The 422-shaped check (positive initial, etc.)
  lives in the Pydantic schema; the cross-field constraint
  ``current <= initial`` is service-layer and surfaces as a 409 because it can
  involve fields from two different requests (PATCH that flips just one of
  them).
- ``delete_fabric_roll`` blocks if a ``CuttingOrder`` references the roll
  (either as ``body_roll_id`` or ``rib_roll_id``), regardless of the cutting
  order's status.
"""

from __future__ import annotations

import uuid
from datetime import datetime, time
from decimal import Decimal

from sqlalchemy import String, cast, func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    CuttingOrder,
    FabricMovementKind,
    FabricRoll,
    FabricRollKind,
    FabricRollMovement,
    FabricType,
)
from schemas._common import PageParams
from schemas.fabric import (
    FabricMovementCreate,
    FabricMovementFilters,
    FabricRollCreate,
    FabricRollFilters,
    FabricRollUpdate,
)
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError

_RESOURCE = "fabric_rolls"
_MOVEMENT_RESOURCE = "fabric_roll_movements"

# ENTRY + ADJUSTMENT credit current_weight_kg; EXIT debits it.
_CREDIT_KINDS = (FabricMovementKind.ENTRY, FabricMovementKind.ADJUSTMENT)


def _to_read_kwargs(roll: FabricRoll) -> dict:
    """Build the kwargs dict the router uses to materialise a ``FabricRollRead``.

    Centralising the ``consumed_kg`` computation in one place keeps the router
    thin and guarantees the math is identical regardless of the entry point.
    """

    consumed = roll.initial_weight_kg - roll.current_weight_kg
    return {
        "id": roll.id,
        "received_at": roll.received_at,
        "supplier_name": roll.supplier_name,
        "kind": roll.kind,
        "fabric_type": roll.fabric_type,
        "initial_weight_kg": roll.initial_weight_kg,
        "current_weight_kg": roll.current_weight_kg,
        "consumed_kg": consumed,
        "color": roll.color,
        "price_per_kg": roll.price_per_kg,
        "created_at": roll.created_at,
        "updated_at": roll.updated_at,
    }


async def list_fabric_rolls(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: FabricRollFilters,
    page: PageParams,
) -> tuple[list[FabricRoll], int]:
    base = scoped(select(FabricRoll), FabricRoll, company_id)
    if filters.q:
        needle = filters.q.strip().lower()
        like = f"%{needle}%"
        base = base.where(
            or_(
                func.lower(FabricRoll.supplier_name).like(like),
                func.lower(FabricRoll.color).like(like),
                func.lower(cast(FabricRoll.fabric_type, String)).like(like),
            )
        )
    if filters.kind is not None:
        base = base.where(FabricRoll.kind == filters.kind)
    if filters.fabric_type is not None:
        base = base.where(FabricRoll.fabric_type == filters.fabric_type)

    total_result = await db.exec(select(func.count()).select_from(base.subquery()))
    total = int(total_result.one() or 0)

    items_stmt = (
        base.order_by(FabricRoll.received_at.desc(), FabricRoll.created_at.desc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    items_result = await db.exec(items_stmt)
    return list(items_result.all()), total


async def get_fabric_roll(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    roll_id: uuid.UUID,
) -> FabricRoll:
    stmt = scoped(select(FabricRoll), FabricRoll, company_id).where(FabricRoll.id == roll_id)
    result = await db.exec(stmt)
    roll = result.first()
    if roll is None:
        raise NotFoundError(detail="Fabric roll not found")
    return roll


async def create_fabric_roll(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: FabricRollCreate,
) -> FabricRoll:
    current = payload.current_weight_kg if payload.current_weight_kg is not None else payload.initial_weight_kg
    if current > payload.initial_weight_kg:
        raise ConflictError(detail="current_weight_kg cannot exceed initial_weight_kg")

    roll = FabricRoll(
        company_id=company_id,
        received_at=payload.received_at,
        supplier_name=payload.supplier_name.strip(),
        kind=payload.kind,
        fabric_type=payload.fabric_type,
        initial_weight_kg=payload.initial_weight_kg,
        current_weight_kg=current,
        color=payload.color.strip(),
        price_per_kg=payload.price_per_kg,
    )
    db.add(roll)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=roll.id,
        message=f"Fabric roll created: {roll.supplier_name} / {roll.fabric_type.value} ({roll.initial_weight_kg} kg)",
    )
    await db.commit()
    await db.refresh(roll)
    return roll


async def update_fabric_roll(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    roll_id: uuid.UUID,
    payload: FabricRollUpdate,
) -> FabricRoll:
    roll = await get_fabric_roll(db, company_id=company_id, roll_id=roll_id)

    data = payload.model_dump(exclude_unset=True)

    # Project the post-update weights and validate the cross-field invariant BEFORE
    # mutating the mapped instance — otherwise an in-flight ConflictError would
    # leave the session dirty across the rest of the request lifecycle.
    proposed_initial = (
        data["initial_weight_kg"]
        if "initial_weight_kg" in data and data["initial_weight_kg"] is not None
        else roll.initial_weight_kg
    )
    proposed_current = (
        data["current_weight_kg"]
        if "current_weight_kg" in data and data["current_weight_kg"] is not None
        else roll.current_weight_kg
    )
    if proposed_current > proposed_initial:
        raise ConflictError(detail="current_weight_kg cannot exceed initial_weight_kg")

    if "supplier_name" in data and data["supplier_name"] is not None:
        roll.supplier_name = data["supplier_name"].strip()
    if "color" in data and data["color"] is not None:
        roll.color = data["color"].strip()
    if "received_at" in data and data["received_at"] is not None:
        roll.received_at = data["received_at"]
    if "kind" in data and data["kind"] is not None:
        roll.kind = data["kind"]
    if "fabric_type" in data and data["fabric_type"] is not None:
        roll.fabric_type = data["fabric_type"]
    if "initial_weight_kg" in data and data["initial_weight_kg"] is not None:
        roll.initial_weight_kg = data["initial_weight_kg"]
    if "current_weight_kg" in data and data["current_weight_kg"] is not None:
        roll.current_weight_kg = data["current_weight_kg"]
    if "price_per_kg" in data and data["price_per_kg"] is not None:
        roll.price_per_kg = data["price_per_kg"]

    db.add(roll)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=roll.id,
        message=f"Fabric roll updated: {roll.supplier_name} / {roll.fabric_type.value}",
    )
    await db.commit()
    await db.refresh(roll)
    return roll


async def _assert_no_cutting_orders(db: AsyncSession, *, roll_id: uuid.UUID) -> None:
    stmt = (
        select(func.count())
        .select_from(CuttingOrder)
        .where(or_(CuttingOrder.body_roll_id == roll_id, CuttingOrder.rib_roll_id == roll_id))
    )
    result = await db.exec(stmt)
    if int(result.first() or 0) > 0:
        raise ConflictError(detail="Cannot delete fabric roll — it is referenced by a cutting order")


async def _assert_no_movements(db: AsyncSession, *, company_id: uuid.UUID, roll_id: uuid.UUID) -> None:
    stmt = scoped(select(func.count()), FabricRollMovement, company_id).where(
        FabricRollMovement.fabric_roll_id == roll_id
    )
    if int((await db.exec(stmt)).first() or 0) > 0:
        raise ConflictError(detail="Cannot delete fabric roll — it has stock movements")


async def delete_fabric_roll(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    roll_id: uuid.UUID,
) -> None:
    roll = await get_fabric_roll(db, company_id=company_id, roll_id=roll_id)
    await _assert_no_cutting_orders(db, roll_id=roll.id)
    await _assert_no_movements(db, company_id=company_id, roll_id=roll.id)

    label = f"{roll.supplier_name} / {roll.fabric_type.value}"
    await db.delete(roll)
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=roll.id,
        message=f"Fabric roll deleted: {label}",
    )
    await db.commit()


# ---------- consume (transition-internal, no commit) ----------


async def consume(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    roll: FabricRoll,
    quantity: Decimal,
    cutting_order_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> FabricRollMovement:
    """Debit kg off the roll, clamping at 0, recording an EXIT movement.

    Transition-internal: the metered-roll rule (``max(0, current - quantity)``)
    matches ``paper_roll.consume`` and the prototype's ``Math.max(0, …)``. The
    recorded ``quantity`` is the *actual* amount consumed after the clamp (never
    more than the roll held). This helper does NOT commit — the caller (the
    cutting-DONE transition) owns the transaction — and does NOT write audit
    (the caller writes a transition-level entry).
    """

    actual = min(quantity, roll.current_weight_kg)
    roll.current_weight_kg = max(Decimal("0"), roll.current_weight_kg - quantity)
    db.add(roll)

    movement = FabricRollMovement(
        company_id=company_id,
        fabric_roll_id=roll.id,
        kind=FabricMovementKind.EXIT,
        quantity=actual if actual > 0 else quantity,
        cutting_order_id=cutting_order_id,
        notes=notes,
    )
    db.add(movement)
    await db.flush()
    return movement


# ---------- create_movement (manual move sheet) ----------


async def create_movement(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: FabricMovementCreate,
) -> FabricRollMovement:
    """Manual ledger entry against a roll that also adjusts ``current_weight_kg``.

    ENTRY/ADJUSTMENT add to current (no upper clamp — entries add stock); EXIT
    clamps current at 0. ``cutting_order_id`` is always null here (manual);
    cutting-sourced exits are written by the T1 transition via :func:`consume`.
    """

    roll = await get_fabric_roll(db, company_id=company_id, roll_id=payload.fabric_roll_id)

    if payload.kind in _CREDIT_KINDS:
        roll.current_weight_kg = roll.current_weight_kg + payload.quantity
    else:  # EXIT
        roll.current_weight_kg = max(Decimal("0"), roll.current_weight_kg - payload.quantity)
    db.add(roll)

    movement = FabricRollMovement(
        company_id=company_id,
        fabric_roll_id=roll.id,
        kind=payload.kind,
        quantity=payload.quantity,
        cutting_order_id=None,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(movement)
    await db.flush()

    sign = "-" if payload.kind == FabricMovementKind.EXIT else "+"
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_MOVEMENT_RESOURCE,
        resource_id=movement.id,
        message=(
            f"Fabric roll movement for {roll.supplier_name} / {roll.fabric_type.value}: "
            f"{sign}{movement.quantity} kg ({movement.kind.value})"
        ),
    )
    await db.commit()
    await db.refresh(movement)
    return movement


# ---------- list_movements ----------


def _start_of_day(d) -> datetime:
    return datetime.combine(d, time.min)


def _end_of_day(d) -> datetime:
    return datetime.combine(d, time.max)


async def list_movements(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: FabricMovementFilters,
    page: PageParams,
) -> tuple[list[dict], int]:
    """The ledger, joined to its fabric roll, newest first."""

    base = scoped(select(FabricRollMovement, FabricRoll), FabricRollMovement, company_id).join(
        FabricRoll, FabricRoll.id == FabricRollMovement.fabric_roll_id, isouter=True
    )

    if filters.fabric_roll_id is not None:
        base = base.where(FabricRollMovement.fabric_roll_id == filters.fabric_roll_id)
    if filters.kind is not None:
        base = base.where(cast(FabricRollMovement.kind, String) == filters.kind.value)
    if filters.date_from is not None:
        base = base.where(FabricRollMovement.created_at >= _start_of_day(filters.date_from))
    if filters.date_to is not None:
        base = base.where(FabricRollMovement.created_at <= _end_of_day(filters.date_to))

    total = int((await db.exec(select(func.count()).select_from(base.subquery()))).one() or 0)

    rows_stmt = base.order_by(FabricRollMovement.created_at.desc()).offset(page.offset).limit(page.page_size)
    result = await db.exec(rows_stmt)
    rows: list[dict] = []
    for movement, roll in result.all():
        rows.append(
            {
                "id": movement.id,
                "fabric_roll_id": movement.fabric_roll_id,
                "fabric_roll": None
                if roll is None
                else {
                    "id": roll.id,
                    "fabric_type": roll.fabric_type,
                    "supplier_name": roll.supplier_name,
                    "color": roll.color,
                },
                "kind": movement.kind,
                "quantity": movement.quantity,
                "cutting_order_id": movement.cutting_order_id,
                "notes": movement.notes,
                "created_at": movement.created_at,
            }
        )
    return rows, total


__all__ = [
    "_to_read_kwargs",
    "consume",
    "create_fabric_roll",
    "create_movement",
    "delete_fabric_roll",
    "get_fabric_roll",
    "list_fabric_rolls",
    "list_movements",
    "update_fabric_roll",
]

# Re-export so test utilities can import the canonical decimal/enum types alongside the service.
_ = (FabricRollKind, FabricType, Decimal)
