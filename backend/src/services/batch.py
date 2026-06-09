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
- Per-stamp print quantities live in :class:`BatchPrintAdjustment`, aggregated
  from the batch's orders by ``(print_design, product_color)``.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    Batch,
    BatchPrintAdjustment,
    BatchStatus,
    Order,
    PrintDesign,
    PrintStockDirection,
    PrintStockMovement,
    Product,
    ProductVariation,
)
from schemas._common import PageParams
from schemas.batch import BatchAdjustmentRow
from services._audit import write_audit
from services._base import scoped
from services.print_stock import compute_on_hand_map
from shared.exceptions import ConflictError, NotFoundError, ValidationError

_RESOURCE = "batches"

# A loaded adjustment row plus its print design's code/name for the wire shape.
AdjustmentWithDesign = tuple[BatchPrintAdjustment, str | None, str | None]
BatchWithAdjustments = tuple[Batch, list[AdjustmentWithDesign]]


# --------------------------------------------------------------------- helpers


def _short_code(value: uuid.UUID) -> str:
    """Compact human code for audit messages: ``BAT-XXXXXXXX``."""

    return f"BAT-{value.hex[:8].upper()}"


# Valid forward transitions for a batch's lifecycle.
_FORWARD: dict[BatchStatus, set[BatchStatus]] = {
    BatchStatus.OPEN: {BatchStatus.ADJUSTED, BatchStatus.CANCELLED},
    BatchStatus.ADJUSTED: {BatchStatus.PRINTED, BatchStatus.CANCELLED},
    BatchStatus.PRINTED: {BatchStatus.DONE, BatchStatus.CANCELLED},
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


async def _load_orders_for_batch(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    batch_id: uuid.UUID,
):
    """Orders in the batch joined to variation + product + print design.

    Returns rows of ``(Order, ProductVariation, Product, PrintDesign | None)``.
    """

    stmt = (
        select(Order, ProductVariation, Product, PrintDesign)
        .join(ProductVariation, ProductVariation.id == Order.variation_id)
        .join(Product, Product.id == ProductVariation.product_id)
        .join(PrintDesign, PrintDesign.id == Product.print_id, isouter=True)
        .where(Order.company_id == company_id, Order.batch_id == batch_id)
    )
    return list((await db.exec(stmt)).all())


async def _load_adjustments(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    batch_id: uuid.UUID,
) -> list[AdjustmentWithDesign]:
    stmt = (
        select(BatchPrintAdjustment, PrintDesign.code, PrintDesign.name)
        .join(PrintDesign, PrintDesign.id == BatchPrintAdjustment.print_design_id, isouter=True)
        .where(BatchPrintAdjustment.company_id == company_id, BatchPrintAdjustment.batch_id == batch_id)
        .order_by(PrintDesign.code, BatchPrintAdjustment.product_color)  # type: ignore[arg-type]
    )
    return list((await db.exec(stmt)).all())  # type: ignore[return-value]


async def _get_batch(db: AsyncSession, *, company_id: uuid.UUID, batch_id: uuid.UUID) -> Batch:
    stmt = scoped(select(Batch), Batch, company_id).where(Batch.id == batch_id)
    batch = (await db.exec(stmt)).first()
    if batch is None:
        raise NotFoundError(detail="Batch not found")
    return batch


async def _recompute_adjustments(db: AsyncSession, *, company_id: uuid.UUID, batch: Batch) -> None:
    """Rebuild the batch's ``BatchPrintAdjustment`` rows from its orders.

    Aggregates required pieces by ``(print_design, product_color)`` and NETS them
    against the live printed-stamp on-hand (``print_stock`` ledger): a new row's
    ``qty_to_print`` defaults to ``max(0, qty_needed - on_hand)`` so the operator
    only prints the shortfall. The operator's manual ``qty_to_print`` decision on
    an EXISTING row is preserved across recomputes — only ``qty_needed`` and
    ``qty_stock`` refresh. Orders whose product has no print design are skipped
    (nothing to print).
    """

    rows = await _load_orders_for_batch(db, company_id=company_id, batch_id=batch.id)

    needed: dict[tuple[uuid.UUID, str], int] = defaultdict(int)
    for order, variation, _product, design in rows:
        if design is None:
            continue
        needed[(design.id, variation.color)] += order.quantity

    # Pull real printed-stamp on-hand once (single bulk aggregation) so each
    # adjustment's qty_stock reflects the print-stock ledger instead of 0.
    on_hand_map = await compute_on_hand_map(db, company_id=company_id)

    existing = {
        (a.print_design_id, a.product_color): a
        for a in (
            await db.exec(
                scoped(select(BatchPrintAdjustment), BatchPrintAdjustment, company_id).where(
                    BatchPrintAdjustment.batch_id == batch.id
                )
            )
        ).all()
    }

    seen: set[tuple[uuid.UUID, str]] = set()
    for key, qty in needed.items():
        seen.add(key)
        # Real printed-stamp stock on hand for this (design, colour); clamp
        # negatives (over-consumed ledgers) to 0 — qty_stock has a >= 0 check.
        qty_stock = max(0, on_hand_map.get(key, 0))
        row = existing.get(key)
        if row is None:
            # Auto-net: only print the shortfall after consuming on-hand stamps.
            db.add(
                BatchPrintAdjustment(
                    company_id=company_id,
                    batch_id=batch.id,
                    print_design_id=key[0],
                    product_color=key[1],
                    qty_needed=qty,
                    qty_stock=qty_stock,
                    qty_to_print=max(0, qty - qty_stock),
                )
            )
        else:
            # Preserve the operator's qty_to_print decision; refresh the
            # demand + on-hand snapshot only.
            row.qty_needed = qty
            row.qty_stock = qty_stock
            db.add(row)

    # Drop adjustment rows whose stamp/colour no longer appears in the batch.
    for key, row in existing.items():
        if key not in seen:
            await db.delete(row)

    await db.flush()


# --------------------------------------------------------------------- create


async def create_batch(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    order_ids: list[uuid.UUID],
    name: str | None = None,
) -> BatchWithAdjustments:
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

    await _recompute_adjustments(db, company_id=company_id, batch=batch)

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=batch.id,
        message=f"Created batch {batch.code} ({_short_code(batch.id)}) with {len(orders)} orders",
    )
    await db.commit()
    return await get_batch(db, company_id=company_id, batch_id=batch.id)


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
) -> BatchWithAdjustments:
    batch = await _get_batch(db, company_id=company_id, batch_id=batch_id)
    adjustments = await _load_adjustments(db, company_id=company_id, batch_id=batch_id)
    return batch, adjustments


# ------------------------------------------------------------- adjustments


async def save_adjustments(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    batch_id: uuid.UUID,
    adjustments: list[BatchAdjustmentRow],
) -> BatchWithAdjustments:
    batch = await _get_batch(db, company_id=company_id, batch_id=batch_id)

    # The UI adjusts at the design level; set every colour row of that design to
    # the submitted value.
    by_design: dict[uuid.UUID, int] = {a.print_design_id: a.qty_to_print for a in adjustments}
    for design_id, qty in by_design.items():
        for row in (
            await db.exec(
                scoped(select(BatchPrintAdjustment), BatchPrintAdjustment, company_id).where(
                    BatchPrintAdjustment.batch_id == batch_id,
                    BatchPrintAdjustment.print_design_id == design_id,
                )
            )
        ).all():
            row.qty_to_print = qty
            db.add(row)

    if batch.status == BatchStatus.OPEN:
        batch.status = BatchStatus.ADJUSTED
        db.add(batch)

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=batch.id,
        message=f"Saved print adjustments for batch {batch.code}",
    )
    await db.commit()
    return await get_batch(db, company_id=company_id, batch_id=batch_id)


# ------------------------------------------------------------------ status


async def _commit_print_stock_exits(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    batch: Batch,
) -> int:
    """Debit the print-stock ledger for a batch's to-print quantities.

    Writes one ``PrintStockMovement`` EXIT per adjustment row that has
    ``qty_to_print > 0`` and has not yet been committed (``stock_committed_at``
    is NULL), then stamps that flag so a re-transition never double-decrements.

    The exit deliberately does NOT enforce the no-negative-stock guard used by
    the manual ``print_stock.create_exit`` path: a batch consumes exactly the
    quantity it decided to print regardless of current on-hand (the netting only
    nets what stock existed at recompute time). Returns the number of EXITs
    written. Caller is responsible for the surrounding commit.
    """

    rows = (
        await db.exec(
            scoped(select(BatchPrintAdjustment), BatchPrintAdjustment, company_id).where(
                BatchPrintAdjustment.batch_id == batch.id,
                BatchPrintAdjustment.qty_to_print > 0,
                BatchPrintAdjustment.stock_committed_at.is_(None),  # type: ignore[union-attr]
            )
        )
    ).all()

    now = datetime.now(UTC)
    written = 0
    for row in rows:
        db.add(
            PrintStockMovement(
                company_id=company_id,
                print_design_id=row.print_design_id,
                product_color=row.product_color,
                direction=PrintStockDirection.EXIT,
                quantity=row.qty_to_print,
                notes=f"Consumed by batch {batch.code}",
                batch_id=batch.id,
            )
        )
        row.stock_committed_at = now
        db.add(row)
        written += 1
    if written:
        await db.flush()
    return written


async def transition_status(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    batch_id: uuid.UUID,
    target: BatchStatus,
) -> BatchWithAdjustments:
    batch = await _get_batch(db, company_id=company_id, batch_id=batch_id)
    _assert_valid_transition(batch.status, target)
    if batch.status != target:
        previous = batch.status
        batch.status = target
        if target == BatchStatus.DONE:
            batch.completed_at = datetime.now(UTC)
        db.add(batch)

        committed = 0
        if target == BatchStatus.PRINTED:
            # The press run physically produced these stamps and immediately
            # consumed them into the batch's pieces: debit the print-stock
            # ledger exactly once (idempotency via stock_committed_at).
            committed = await _commit_print_stock_exits(db, company_id=company_id, batch=batch)

        suffix = f"; debited {committed} print-stock exit(s)" if committed else ""
        await write_audit(
            db,
            company_id=company_id,
            user_id=user_id,
            resource_type=_RESOURCE,
            resource_id=batch.id,
            message=(f"Marked batch {batch.code} as {target.value.upper()} (was {previous.value.upper()}){suffix}"),
        )
        await db.commit()
    return await get_batch(db, company_id=company_id, batch_id=batch_id)


# ------------------------------------------------------------------ delete


async def delete_batch(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    batch_id: uuid.UUID,
) -> None:
    batch = await _get_batch(db, company_id=company_id, batch_id=batch_id)

    # Unlink member orders back to "no batch" (adjustment rows cascade away).
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


# ------------------------------------------------------------ print queue


# Batch statuses whose adjustments still represent demand waiting to be printed.
_QUEUE_STATUSES = (BatchStatus.OPEN, BatchStatus.ADJUSTED)


async def list_print_queue(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
) -> list[dict]:
    """Cross-batch printing demand, grouped by ``(print_design, product_color)``.

    Aggregates every ``BatchPrintAdjustment`` in a batch whose status is OPEN or
    ADJUSTED, where ``qty_to_print > 0`` and the design has not yet been sent to
    the Montador DTF. This is the operator's "what still needs printing right
    now" worklist across all in-flight batches — the demand-driven print queue.

    Returned rows carry the summed to-print/needed/on-hand plus how many batches
    contribute, sorted by design code then colour.
    """

    stmt = (
        select(
            BatchPrintAdjustment.print_design_id,
            BatchPrintAdjustment.product_color,
            PrintDesign.code,
            PrintDesign.name,
            PrintDesign.image_url,
            func.sum(BatchPrintAdjustment.qty_to_print).label("qty_to_print"),
            func.sum(BatchPrintAdjustment.qty_needed).label("qty_needed"),
            func.coalesce(func.max(BatchPrintAdjustment.qty_stock), 0).label("qty_stock"),
            func.count(func.distinct(BatchPrintAdjustment.batch_id)).label("batch_count"),
        )
        .join(Batch, Batch.id == BatchPrintAdjustment.batch_id)
        .join(PrintDesign, PrintDesign.id == BatchPrintAdjustment.print_design_id, isouter=True)
        .where(
            BatchPrintAdjustment.company_id == company_id,
            BatchPrintAdjustment.qty_to_print > 0,
            BatchPrintAdjustment.prints_sent.is_(False),  # type: ignore[union-attr]
            Batch.status.in_(_QUEUE_STATUSES),  # type: ignore[attr-defined]
        )
        .group_by(
            BatchPrintAdjustment.print_design_id,
            BatchPrintAdjustment.product_color,
            PrintDesign.code,
            PrintDesign.name,
            PrintDesign.image_url,
        )
        .order_by(PrintDesign.code.asc(), BatchPrintAdjustment.product_color.asc())  # type: ignore[union-attr]
    )

    result = await db.exec(stmt)
    rows: list[dict] = []
    for row in result.all():
        rows.append(
            {
                "print_design_id": row[0],
                "product_color": row[1],
                "design": None
                if row[0] is None
                else {
                    "id": row[0],
                    "code": row[2],
                    "name": row[3],
                    "image_url": row[4],
                },
                "qty_to_print": int(row[5] or 0),
                "qty_needed": int(row[6] or 0),
                "qty_stock": int(row[7] or 0),
                "batch_count": int(row[8] or 0),
            }
        )
    return rows


__all__ = [
    "BatchWithAdjustments",
    "create_batch",
    "delete_batch",
    "get_batch",
    "list_batches",
    "list_print_queue",
    "save_adjustments",
    "transition_status",
]
