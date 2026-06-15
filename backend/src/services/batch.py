"""Service layer for the Batches (Lotes de produção) feature.

Convention notes
----------------
- Every SELECT is :func:`scoped` to the active tenant.
- ``company_id`` is set explicitly on every insert.
- Mutations append an audit-log entry under the ``batches`` resource type.

Domain notes
------------
- A batch groups :class:`Order` rows via ``Order.batch_id``.
- A marketplace order's lines share one ``external_order_id``; the
  multi-product integrity rule keeps all lines of one platform order in the
  same batch (siblings are auto-included on create).
- The per-estampa production grid is computed live from the batch's orders in a
  later phase; the service here owns only the batch's lifecycle + membership.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Batch, BatchStatus, Order
from schemas._common import PageParams
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError, ValidationError

_RESOURCE = "batches"


# --------------------------------------------------------------------- helpers


def _short_code(value: uuid.UUID) -> str:
    """Compact human code for audit messages: ``BAT-XXXXXXXX``."""

    return f"BAT-{value.hex[:8].upper()}"


# Valid forward transitions for a batch's lifecycle.
_FORWARD: dict[BatchStatus, set[BatchStatus]] = {
    BatchStatus.OPEN: {BatchStatus.IN_PRODUCTION, BatchStatus.CANCELLED},
    BatchStatus.IN_PRODUCTION: {BatchStatus.DISPATCHED, BatchStatus.CANCELLED},
    BatchStatus.DISPATCHED: {BatchStatus.DONE, BatchStatus.CANCELLED},
    BatchStatus.DONE: set(),
    BatchStatus.CANCELLED: set(),
}


def _assert_valid_transition(current: BatchStatus, target: BatchStatus) -> None:
    if current == target:
        return
    if target not in _FORWARD.get(current, set()):
        raise ConflictError(detail=f"Cannot transition batch from {current.value} to {target.value}")


async def _generate_code(db: AsyncSession, *, company_id: uuid.UUID) -> str:
    """``BATCH-YYYYMMDD-NNNN`` where NNNN is the next per-day sequence for the tenant."""

    today = datetime.now(UTC).strftime("%Y%m%d")
    prefix = f"BATCH-{today}-"
    stmt = scoped(select(func.count()), Batch, company_id).where(Batch.code.like(f"{prefix}%"))  # type: ignore[attr-defined]
    count = int((await db.exec(stmt)).one() or 0)
    return f"{prefix}{count + 1:04d}"


async def _get_batch(db: AsyncSession, *, company_id: uuid.UUID, batch_id: uuid.UUID) -> Batch:
    stmt = scoped(select(Batch), Batch, company_id).where(Batch.id == batch_id)
    batch = (await db.exec(stmt)).first()
    if batch is None:
        raise NotFoundError(detail="Batch not found")
    return batch


# --------------------------------------------------------------------- create


async def create_batch(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    order_ids: list[uuid.UUID],
    name: str | None = None,
) -> Batch:
    unique_ids = list(dict.fromkeys(order_ids))
    if not unique_ids:
        raise ValidationError(detail="At least one order is required")

    selected = list(
        (
            await db.exec(scoped(select(Order), Order, company_id).where(Order.id.in_(unique_ids)))  # type: ignore[attr-defined]
        ).all()
    )
    if len(selected) != len(unique_ids):
        raise ValidationError(detail="One or more orders were not found for this company")

    already_batched = [o for o in selected if o.batch_id is not None]
    if already_batched:
        raise ConflictError(detail="One or more selected orders already belong to a batch")

    # Multi-product integrity: pull sibling order lines that share an
    # external_order_id and are not yet batched, so a platform order is never
    # split across batches.
    external_ids = {o.external_order_id for o in selected if o.external_order_id}
    siblings: list[Order] = []
    if external_ids:
        siblings = list(
            (
                await db.exec(
                    scoped(select(Order), Order, company_id).where(
                        Order.external_order_id.in_(external_ids),  # type: ignore[attr-defined]
                        Order.batch_id.is_(None),  # type: ignore[union-attr]
                    )
                )
            ).all()
        )

    orders_by_id = {o.id: o for o in [*selected, *siblings]}
    orders = list(orders_by_id.values())

    code = await _generate_code(db, company_id=company_id)
    batch = Batch(
        company_id=company_id,
        code=code,
        name=(name.strip() if name and name.strip() else None),
        status=BatchStatus.OPEN,
        total_orders=len(orders),
        total_pieces=sum(o.quantity for o in orders),
    )
    db.add(batch)
    try:
        await db.flush()
    except IntegrityError as exc:  # pragma: no cover - code collision is rare
        await db.rollback()
        raise ConflictError(detail="Batch code collision, please retry") from exc

    for order in orders:
        order.batch_id = batch.id
        db.add(order)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=batch.id,
        message=f"Created batch {batch.code} ({_short_code(batch.id)}) with {len(orders)} orders",
    )
    await db.commit()
    return await _get_batch(db, company_id=company_id, batch_id=batch.id)


# ----------------------------------------------------------------------- read


async def list_batches(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    status: BatchStatus | None = None,
    page: PageParams | None = None,
) -> tuple[list[Batch], int]:
    page = page or PageParams()
    base = scoped(select(Batch), Batch, company_id)
    if status is not None:
        base = base.where(Batch.status == status)

    count_stmt = scoped(select(func.count()), Batch, company_id)
    if status is not None:
        count_stmt = count_stmt.where(Batch.status == status)
    total = int((await db.exec(count_stmt)).one() or 0)

    rows = list(
        (
            await db.exec(
                base.order_by(Batch.created_at.desc())  # type: ignore[attr-defined]
                .offset(page.offset)
                .limit(page.page_size)
            )
        ).all()
    )
    return rows, total


async def get_batch(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    batch_id: uuid.UUID,
) -> Batch:
    return await _get_batch(db, company_id=company_id, batch_id=batch_id)


# ------------------------------------------------------------------ status


async def transition_status(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    batch_id: uuid.UUID,
    target: BatchStatus,
) -> Batch:
    batch = await _get_batch(db, company_id=company_id, batch_id=batch_id)
    _assert_valid_transition(batch.status, target)
    if batch.status != target:
        previous = batch.status
        batch.status = target
        if target == BatchStatus.DONE:
            batch.completed_at = datetime.now(UTC)
        db.add(batch)

        await write_audit(
            db,
            company_id=company_id,
            user_id=user_id,
            resource_type=_RESOURCE,
            resource_id=batch.id,
            message=f"Marked batch {batch.code} as {target.value.upper()} (was {previous.value.upper()})",
        )
        await db.commit()
    return await _get_batch(db, company_id=company_id, batch_id=batch_id)


# ------------------------------------------------------------------ delete


async def delete_batch(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    batch_id: uuid.UUID,
) -> None:
    batch = await _get_batch(db, company_id=company_id, batch_id=batch_id)

    # Unlink member orders back to "no batch".
    for order in (await db.exec(scoped(select(Order), Order, company_id).where(Order.batch_id == batch_id))).all():
        order.batch_id = None
        db.add(order)
    await db.flush()

    code = batch.code
    await db.delete(batch)
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=batch_id,
        message=f"Deleted batch {code}",
    )
    await db.commit()


__all__ = [
    "create_batch",
    "delete_batch",
    "get_batch",
    "list_batches",
    "transition_status",
]
