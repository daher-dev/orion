"""Service layer for the Paper Rolls (bobinas de papel/filme) WIP inventory tier.

Convention notes
----------------
- Mirrors ``services.fabric``: ``current_meters`` is the authoritative on-hand
  (NOT a ledger sum); the ``paper_roll_movements`` ledger records history. The
  422-shaped checks (positive initial, etc.) live in the Pydantic schema; the
  cross-field ``current <= initial`` invariant is service-layer and surfaces as
  a 409.
- ``create_paper_roll`` defaults ``current_meters`` to ``initial_meters`` when
  omitted.
- ``consume`` clamps at 0 (``new = max(0, current - quantity)``, matching the
  metered-roll rule and the prototype's ``Math.max(0, …)``) and records a
  ``PaperRollMovement(kind=EXIT, quantity=actual_consumed)``.
- ``create_movement`` is a manual ledger entry that also applies to
  ``current_meters``: ENTRY/ADJUSTMENT add (no upper clamp — entries add
  stock), EXIT clamps at 0 like ``consume``.
- ``delete_paper_roll`` is blocked when any ``PaperRollMovement`` references the
  roll (the FK is ``ondelete=RESTRICT``) → ``ConflictError``.
- ``low_stock``: a row-level ``min_stock`` (absolute meters floor) overrides the
  company-wide ``paper`` threshold (default % of initial); when neither applies,
  never low.
- Every SELECT is tenant-scoped via :func:`scoped`; mutations write a single
  audit entry under ``paper_rolls`` / ``paper_roll_movements``.
"""

from __future__ import annotations

import uuid
from datetime import datetime, time
from decimal import Decimal
from typing import Any

from sqlalchemy import String, cast, func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import PaperMovementKind, PaperRoll, PaperRollMovement
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
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError

_RESOURCE = "paper_rolls"
_MOVEMENT_RESOURCE = "paper_roll_movements"
_THRESHOLD_KEY = "paper"

# ENTRY + ADJUSTMENT credit current_meters; EXIT debits it.
_CREDIT_KINDS = (PaperMovementKind.ENTRY, PaperMovementKind.ADJUSTMENT)


def _is_low_stock(*, roll: PaperRoll, threshold: dict[str, Any] | None) -> bool:
    """Metered-tier low-stock rule.

    - row ``min_stock`` (absolute meters floor) overrides everything;
    - else the config threshold: ``pct`` is relative to ``initial_meters``, an
      absolute unit (``m``/``qty``/``kg``) compares against the value directly;
    - else never low.
    """

    if roll.min_stock is not None:
        return roll.current_meters <= roll.min_stock
    if threshold and threshold.get("enabled") and threshold.get("value") is not None:
        value = Decimal(str(threshold["value"]))
        unit = threshold.get("unit")
        if unit == "pct":
            return roll.current_meters <= roll.initial_meters * value / Decimal("100")
        return roll.current_meters <= value
    return False


def _to_read_kwargs(roll: PaperRoll, *, low_stock: bool) -> dict:
    """Build the kwargs dict the router uses to materialise a ``PaperRollRead``."""

    consumed = roll.initial_meters - roll.current_meters
    return {
        "id": roll.id,
        "received_at": roll.received_at,
        "supplier_name": roll.supplier_name,
        "paper_type": roll.paper_type,
        "width_cm": roll.width_cm,
        "initial_meters": roll.initial_meters,
        "current_meters": roll.current_meters,
        "consumed_meters": consumed,
        "min_stock": roll.min_stock,
        "on_hand": roll.current_meters,
        "low_stock": low_stock,
        "created_at": roll.created_at,
        "updated_at": roll.updated_at,
    }


# ---------- helpers ----------


async def _threshold(db: AsyncSession, *, company_id: uuid.UUID) -> dict[str, Any] | None:
    settings = await settings_service.get_settings(db, company_id=company_id)
    return settings.config.get("stockThresholds", {}).get(_THRESHOLD_KEY)


async def get_paper_roll(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    roll_id: uuid.UUID,
) -> PaperRoll:
    stmt = scoped(select(PaperRoll), PaperRoll, company_id).where(PaperRoll.id == roll_id)
    roll = (await db.exec(stmt)).first()
    if roll is None:
        raise NotFoundError(detail="Paper roll not found")
    return roll


# ---------- list_paper_rolls ----------


async def list_paper_rolls(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: PaperRollFilters,
    page: PageParams,
) -> tuple[list[PaperRoll], int]:
    base = scoped(select(PaperRoll), PaperRoll, company_id)
    if filters.q:
        like = f"%{filters.q.strip().lower()}%"
        base = base.where(
            or_(
                func.lower(PaperRoll.supplier_name).like(like),
                func.lower(cast(PaperRoll.paper_type, String)).like(like),
            )
        )
    if filters.paper_type is not None:
        base = base.where(PaperRoll.paper_type == filters.paper_type)

    threshold = await _threshold(db, company_id=company_id)

    if filters.low_stock_only:
        # `low_stock` is config-driven (pct of initial), so the filter runs in
        # Python after fetch — acceptable since paper rolls are few per tenant.
        rows_stmt = base.order_by(PaperRoll.received_at.desc(), PaperRoll.created_at.desc())
        all_rolls = list((await db.exec(rows_stmt)).all())
        filtered = [r for r in all_rolls if _is_low_stock(roll=r, threshold=threshold)]
        total = len(filtered)
        return filtered[page.offset : page.offset + page.page_size], total

    total = int((await db.exec(select(func.count()).select_from(base.subquery()))).one() or 0)
    items_stmt = (
        base.order_by(PaperRoll.received_at.desc(), PaperRoll.created_at.desc())
        .offset(page.offset)
        .limit(page.page_size)
    )
    return list((await db.exec(items_stmt)).all()), total


# ---------- create_paper_roll ----------


async def create_paper_roll(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: PaperRollCreate,
) -> PaperRoll:
    current = payload.current_meters if payload.current_meters is not None else payload.initial_meters
    if current > payload.initial_meters:
        raise ConflictError(detail="current_meters cannot exceed initial_meters")

    roll = PaperRoll(
        company_id=company_id,
        received_at=payload.received_at,
        supplier_name=payload.supplier_name.strip(),
        paper_type=payload.paper_type,
        width_cm=payload.width_cm,
        initial_meters=payload.initial_meters,
        current_meters=current,
        min_stock=payload.min_stock,
    )
    db.add(roll)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=roll.id,
        message=f"Paper roll created: {roll.supplier_name} / {roll.paper_type.value} ({roll.initial_meters} m)",
    )
    await db.commit()
    await db.refresh(roll)
    return roll


# ---------- update_paper_roll ----------


async def update_paper_roll(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    roll_id: uuid.UUID,
    payload: PaperRollUpdate,
) -> PaperRoll:
    roll = await get_paper_roll(db, company_id=company_id, roll_id=roll_id)
    data = payload.model_dump(exclude_unset=True)

    # Validate the cross-field invariant on the projected post-update values
    # BEFORE mutating the mapped instance (a mid-flight ConflictError must not
    # leave the session dirty).
    proposed_initial = (
        data["initial_meters"]
        if "initial_meters" in data and data["initial_meters"] is not None
        else roll.initial_meters
    )
    proposed_current = (
        data["current_meters"]
        if "current_meters" in data and data["current_meters"] is not None
        else roll.current_meters
    )
    if proposed_current > proposed_initial:
        raise ConflictError(detail="current_meters cannot exceed initial_meters")

    if "received_at" in data and data["received_at"] is not None:
        roll.received_at = data["received_at"]
    if "supplier_name" in data and data["supplier_name"] is not None:
        roll.supplier_name = data["supplier_name"].strip()
    if "paper_type" in data and data["paper_type"] is not None:
        roll.paper_type = data["paper_type"]
    if "width_cm" in data and data["width_cm"] is not None:
        roll.width_cm = data["width_cm"]
    if "initial_meters" in data and data["initial_meters"] is not None:
        roll.initial_meters = data["initial_meters"]
    if "current_meters" in data and data["current_meters"] is not None:
        roll.current_meters = data["current_meters"]
    # `min_stock` is nullable — an explicit null clears it.
    if "min_stock" in data:
        roll.min_stock = data["min_stock"]

    db.add(roll)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=roll.id,
        message=f"Paper roll updated: {roll.supplier_name} / {roll.paper_type.value}",
    )
    await db.commit()
    await db.refresh(roll)
    return roll


# ---------- delete_paper_roll ----------


async def _assert_no_movements(db: AsyncSession, *, company_id: uuid.UUID, roll_id: uuid.UUID) -> None:
    stmt = scoped(select(func.count()), PaperRollMovement, company_id).where(PaperRollMovement.paper_roll_id == roll_id)
    if int((await db.exec(stmt)).first() or 0) > 0:
        raise ConflictError(detail="Cannot delete paper roll — it has stock movements")


async def delete_paper_roll(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    roll_id: uuid.UUID,
) -> None:
    roll = await get_paper_roll(db, company_id=company_id, roll_id=roll_id)
    await _assert_no_movements(db, company_id=company_id, roll_id=roll.id)

    label = f"{roll.supplier_name} / {roll.paper_type.value}"
    await db.delete(roll)
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=roll.id,
        message=f"Paper roll deleted: {label}",
    )
    await db.commit()


# ---------- consume ----------


async def consume(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    roll_id: uuid.UUID,
    payload: PaperRollConsume,
) -> PaperRoll:
    """Debit meters off the roll, clamping at 0, recording an EXIT movement.

    The actual consumed amount (after clamp) is what gets recorded — never more
    than the roll holds.
    """

    roll = await get_paper_roll(db, company_id=company_id, roll_id=roll_id)
    actual = min(payload.quantity, roll.current_meters)
    roll.current_meters = max(Decimal("0"), roll.current_meters - payload.quantity)
    db.add(roll)

    movement = PaperRollMovement(
        company_id=company_id,
        paper_roll_id=roll.id,
        kind=PaperMovementKind.EXIT,
        quantity=actual if actual > 0 else payload.quantity,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(movement)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_MOVEMENT_RESOURCE,
        resource_id=movement.id,
        message=f"Paper roll consumed: {roll.supplier_name} / {roll.paper_type.value} -{actual} m",
    )
    await db.commit()
    await db.refresh(roll)
    return roll


# ---------- create_movement ----------


async def create_movement(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: PaperMovementCreate,
) -> PaperRollMovement:
    """Manual ledger entry against a roll that also adjusts ``current_meters``.

    ENTRY/ADJUSTMENT add to current (no upper clamp); EXIT clamps current at 0.
    """

    roll = await get_paper_roll(db, company_id=company_id, roll_id=payload.paper_roll_id)

    if payload.kind in _CREDIT_KINDS:
        roll.current_meters = roll.current_meters + payload.quantity
    else:  # EXIT
        roll.current_meters = max(Decimal("0"), roll.current_meters - payload.quantity)
    db.add(roll)

    movement = PaperRollMovement(
        company_id=company_id,
        paper_roll_id=roll.id,
        kind=payload.kind,
        quantity=payload.quantity,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(movement)
    await db.flush()

    sign = "-" if payload.kind == PaperMovementKind.EXIT else "+"
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_MOVEMENT_RESOURCE,
        resource_id=movement.id,
        message=(
            f"Paper roll movement for {roll.supplier_name} / {roll.paper_type.value}: "
            f"{sign}{movement.quantity} m ({movement.kind.value})"
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
    filters: PaperMovementFilters,
    page: PageParams,
) -> tuple[list[dict], int]:
    """The ledger, joined to its paper roll, newest first."""

    base = scoped(select(PaperRollMovement, PaperRoll), PaperRollMovement, company_id).join(
        PaperRoll, PaperRoll.id == PaperRollMovement.paper_roll_id, isouter=True
    )

    if filters.paper_roll_id is not None:
        base = base.where(PaperRollMovement.paper_roll_id == filters.paper_roll_id)
    if filters.kind is not None:
        base = base.where(cast(PaperRollMovement.kind, String) == filters.kind.value)
    if filters.date_from is not None:
        base = base.where(PaperRollMovement.created_at >= _start_of_day(filters.date_from))
    if filters.date_to is not None:
        base = base.where(PaperRollMovement.created_at <= _end_of_day(filters.date_to))

    total = int((await db.exec(select(func.count()).select_from(base.subquery()))).one() or 0)

    rows_stmt = base.order_by(PaperRollMovement.created_at.desc()).offset(page.offset).limit(page.page_size)
    result = await db.exec(rows_stmt)
    rows: list[dict] = []
    for movement, roll in result.all():
        rows.append(
            {
                "id": movement.id,
                "paper_roll_id": movement.paper_roll_id,
                "paper_roll": None
                if roll is None
                else {
                    "id": roll.id,
                    "paper_type": roll.paper_type,
                    "supplier_name": roll.supplier_name,
                },
                "kind": movement.kind,
                "quantity": movement.quantity,
                "notes": movement.notes,
                "created_at": movement.created_at,
            }
        )
    return rows, total


# ---------- read kwargs (router helper) ----------


async def to_read(db: AsyncSession, *, company_id: uuid.UUID, roll: PaperRoll) -> dict:
    """Build a ``PaperRollRead`` kwargs dict, resolving ``low_stock`` from settings."""

    threshold = await _threshold(db, company_id=company_id)
    return _to_read_kwargs(roll, low_stock=_is_low_stock(roll=roll, threshold=threshold))


async def to_read_many(db: AsyncSession, *, company_id: uuid.UUID, rolls: list[PaperRoll]) -> list[dict]:
    """Build ``PaperRollRead`` kwargs for a batch, resolving the threshold once."""

    threshold = await _threshold(db, company_id=company_id)
    return [_to_read_kwargs(roll, low_stock=_is_low_stock(roll=roll, threshold=threshold)) for roll in rolls]


__all__ = [
    "_is_low_stock",
    "_to_read_kwargs",
    "consume",
    "create_movement",
    "create_paper_roll",
    "delete_paper_roll",
    "get_paper_roll",
    "list_movements",
    "list_paper_rolls",
    "to_read",
    "to_read_many",
    "update_paper_roll",
]
