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
- The per-estampa production grid (``compute_estampa_grid`` /
  ``get_batch_detail``) is computed live from the batch's orders + the printed-
  transfer / finished-stock ledgers — never stored. ``assemble_batch`` (montar,
  T5) and ``ship_batch`` (enviar, T6) are the two lote actions.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    Batch,
    BatchStatus,
    Order,
    OrderStatus,
    PrintDesign,
    PrintedTransfer,
    PrintSide,
    Product,
    ProductSpec,
    ProductVariation,
    StockEntry,
    StockExit,
)
from schemas._common import PageParams
from schemas.assembly import AssembleBody
from schemas.batch import (
    BatchAssembleBody,
    BatchAssembledRow,
    BatchAssembleResult,
    BatchAssembleSkipped,
    BatchDetailRead,
    BatchEstampaRow,
)
from schemas.print_order import PrintDesignRef
from services import assembly as assembly_service
from services import blank_stock as blank_stock_service
from services import order as order_service
from services import printed_transfer as printed_transfer_service
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


# ----------------------------------------------------- member-order resolution


@dataclass(slots=True)
class _OrderCtx:
    """A member order resolved to its finished-SKU production context.

    ``design`` is the product's estampa (``None`` when the product has no print).
    The batch grid + montar key off ``variation`` (the ordered SKU), ``spec`` (the
    blank base), and ``design`` (the FRONT printed transfer).
    """

    order: Order
    variation: ProductVariation
    spec: ProductSpec
    design: PrintDesign | None


async def _member_orders(db: AsyncSession, *, company_id: uuid.UUID, batch_id: uuid.UUID) -> list[_OrderCtx]:
    """Load the batch's member orders + each one's finished-SKU context.

    ONE join (Order → variation → product → spec, outer-join design) for the
    whole batch. Spec is INNER (every variation's product has a spec); design is
    OUTER (a product may have no estampa).
    """

    stmt = (
        select(Order, ProductVariation, ProductSpec, PrintDesign)
        .join(ProductVariation, ProductVariation.id == Order.variation_id)
        .join(Product, Product.id == ProductVariation.product_id)
        .join(ProductSpec, ProductSpec.id == Product.spec_id)
        .join(PrintDesign, PrintDesign.id == Product.print_id, isouter=True)
        .where(Order.company_id == company_id, Order.batch_id == batch_id)
    )
    rows = (await db.exec(stmt)).all()
    return [_OrderCtx(order=o, variation=v, spec=s, design=d) for (o, v, s, d) in rows]


async def _finished_on_hand_map(
    db: AsyncSession, *, company_id: uuid.UUID, variation_ids: set[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """``{variation_id: on_hand}`` (entries - exits) for the batch's variations.

    Two grouped aggregates filtered to the batch's variation set — the same
    no-N+1 shape as ``planning._finished_on_hand_map``; we do NOT loop
    ``stock._compute_on_hand``. Missing keys default to 0 at the call site.
    """

    if not variation_ids:
        return {}

    entries_stmt = (
        select(StockEntry.variation_id, func.coalesce(func.sum(StockEntry.quantity), 0))
        .where(StockEntry.company_id == company_id, StockEntry.variation_id.in_(variation_ids))  # type: ignore[union-attr]
        .group_by(StockEntry.variation_id)
    )
    exits_stmt = (
        select(StockExit.variation_id, func.coalesce(func.sum(StockExit.quantity), 0))
        .where(StockExit.company_id == company_id, StockExit.variation_id.in_(variation_ids))  # type: ignore[union-attr]
        .group_by(StockExit.variation_id)
    )

    on_hand: dict[uuid.UUID, int] = {}
    for variation_id, total in (await db.exec(entries_stmt)).all():
        on_hand[variation_id] = int(total or 0)
    for variation_id, total in (await db.exec(exits_stmt)).all():
        on_hand[variation_id] = on_hand.get(variation_id, 0) - int(total or 0)
    return on_hand


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


# ---------------------------------------------------- estampa grid (computed)


# Sentinel key for the "no estampa" group (orders whose product has no print).
_NO_DESIGN = "__none__"


def _order_ready(ctx: _OrderCtx, finished_map: dict[uuid.UUID, int]) -> bool:
    return max(0, finished_map.get(ctx.variation.id, 0)) >= ctx.order.quantity


async def compute_estampa_grid(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    contexts: list[_OrderCtx],
) -> list[BatchEstampaRow]:
    """The per-estampa production grid, grouped by :class:`PrintDesign`.

    For each design group across the batch's orders:
    - ``items`` = Σ ``order.quantity`` for that design.
    - ``to_print`` = ``max(0, items - front_printed_on_hand)`` (FRONT transfer).
    - ``montado`` = Σ over the group's distinct variations of
      ``min(needed_for_variation, finished_on_hand[variation])``.
    - ``enviado`` = Σ ``order.quantity`` for orders already SHIPPED.

    Orders with no estampa bucket under a synthetic ``design=None`` row
    (``code="—"``); ``to_print`` for that bucket is 0 (no transfer to print).
    """

    # Finished on-hand for the whole variation set (one pair of aggregates).
    variation_ids = {c.variation.id for c in contexts}
    finished_map = await _finished_on_hand_map(db, company_id=company_id, variation_ids=variation_ids)
    # Printed-transfer on-hand for the tenant (one aggregate, reused per design).
    printed_map = await printed_transfer_service.compute_on_hand_map(db, company_id=company_id)

    # FRONT transfer id per design (one query for the batch's designs).
    design_ids = {c.design.id for c in contexts if c.design is not None}
    front_transfer_by_design: dict[uuid.UUID, uuid.UUID] = {}
    if design_ids:
        transfer_stmt = scoped(
            select(PrintedTransfer.print_design_id, PrintedTransfer.id),
            PrintedTransfer,
            company_id,
        ).where(
            PrintedTransfer.print_design_id.in_(design_ids),  # type: ignore[union-attr]
            PrintedTransfer.side == PrintSide.FRONT,
        )
        for design_id, transfer_id in (await db.exec(transfer_stmt)).all():
            front_transfer_by_design.setdefault(design_id, transfer_id)

    # Group contexts by design (None → the synthetic bucket).
    groups: dict[str, list[_OrderCtx]] = {}
    design_refs: dict[str, PrintDesign | None] = {}
    for ctx in contexts:
        key = str(ctx.design.id) if ctx.design is not None else _NO_DESIGN
        groups.setdefault(key, []).append(ctx)
        design_refs.setdefault(key, ctx.design)

    rows: list[BatchEstampaRow] = []
    for key, group in groups.items():
        design = design_refs[key]
        items = sum(c.order.quantity for c in group)

        # to_print: net FRONT-transfer shortfall (0 for the no-estampa bucket).
        front_on_hand = 0
        if design is not None:
            transfer_id = front_transfer_by_design.get(design.id)
            front_on_hand = max(0, printed_map.get(transfer_id, 0)) if transfer_id is not None else 0
        to_print = max(0, items - front_on_hand) if design is not None else 0

        # montado: finished coverage, summed over the group's distinct variations.
        needed_by_variation: dict[uuid.UUID, int] = {}
        for c in group:
            needed_by_variation[c.variation.id] = needed_by_variation.get(c.variation.id, 0) + c.order.quantity
        montado = sum(
            min(needed, max(0, finished_map.get(variation_id, 0)))
            for variation_id, needed in needed_by_variation.items()
        )

        enviado = sum(c.order.quantity for c in group if c.order.status == OrderStatus.SHIPPED)

        rows.append(
            BatchEstampaRow(
                design=None
                if design is None
                else PrintDesignRef(
                    id=design.id,
                    code=design.code,
                    name=design.name,
                    technique=design.technique,
                    image_url=design.image_url,
                ),
                code=design.code if design is not None else "—",
                items=items,
                to_print=to_print,
                montado=montado,
                is_assembled=montado >= items,
                enviado=enviado,
                is_shipped=all(c.order.status == OrderStatus.SHIPPED for c in group),
            )
        )

    # Stable order: estampa rows by code, the no-estampa bucket last.
    rows.sort(key=lambda r: (r.design is None, r.code))
    return rows


async def get_batch_detail(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    batch_id: uuid.UUID,
) -> BatchDetailRead:
    """Load a batch + compute its grid + readiness roll-ups."""

    batch = await _get_batch(db, company_id=company_id, batch_id=batch_id)
    contexts = await _member_orders(db, company_id=company_id, batch_id=batch_id)

    grid = await compute_estampa_grid(db, company_id=company_id, contexts=contexts)

    variation_ids = {c.variation.id for c in contexts}
    finished_map = await _finished_on_hand_map(db, company_id=company_id, variation_ids=variation_ids)
    orders_ready = sum(1 for c in contexts if _order_ready(c, finished_map))
    orders_total = len(contexts)
    pieces_total = sum(c.order.quantity for c in contexts)
    to_print_total = sum(r.to_print for r in grid)
    needs_assembly = any(r.montado < r.items for r in grid)
    can_ship = (
        orders_total > 0
        and orders_ready == orders_total
        and batch.status in {BatchStatus.OPEN, BatchStatus.IN_PRODUCTION}
    )

    return BatchDetailRead(
        id=batch.id,
        code=batch.code,
        name=batch.name,
        status=batch.status,
        total_orders=batch.total_orders,
        total_pieces=batch.total_pieces,
        labels_printed_at=batch.labels_printed_at,
        completed_at=batch.completed_at,
        notes=batch.notes,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        estampas=grid,
        orders_ready=orders_ready,
        orders_total=orders_total,
        pieces_total=pieces_total,
        to_print_total=to_print_total,
        needs_assembly=needs_assembly,
        can_ship=can_ship,
    )


# ----------------------------------------------------------- assemble (montar)


async def assemble_batch(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    batch_id: uuid.UUID,
    payload: BatchAssembleBody,
) -> BatchAssembleResult:
    """Bulk-assemble the SKUs the batch is short on, reusing T5 (one transaction).

    Per ordered variation, ``need = max(0, sum(order.quantity) - finished_on_hand)``.
    For each variation with ``need > 0`` (restricted to ``payload.rows`` designs
    when provided) resolve the blank ``(spec, size, color_code)`` + the FRONT
    printed transfer ``(design, FRONT)`` and call
    :func:`assembly.assemble_internal`. Component-short variations land in
    ``skipped`` (not a 409) so one missing component never blocks the rest. The
    batch flips OPEN → IN_PRODUCTION when at least one assemble succeeds.
    """

    batch = await _get_batch(db, company_id=company_id, batch_id=batch_id)
    contexts = await _member_orders(db, company_id=company_id, batch_id=batch_id)
    if not contexts:
        raise ConflictError(detail="Batch has no orders to assemble")

    # Optional restriction to specific designs (partial montar).
    restrict_designs: set[uuid.UUID] | None = None
    if payload.rows:
        restrict_designs = {r.design_id for r in payload.rows}

    finished_map = await _finished_on_hand_map(
        db, company_id=company_id, variation_ids={c.variation.id for c in contexts}
    )

    # Aggregate demand per ordered variation (carry one representative context).
    need_by_variation: dict[uuid.UUID, int] = {}
    ctx_by_variation: dict[uuid.UUID, _OrderCtx] = {}
    for c in contexts:
        if c.design is None:
            # No estampa → no assembly is possible (a finished SKU needs a print).
            continue
        if restrict_designs is not None and c.design.id not in restrict_designs:
            continue
        need_by_variation[c.variation.id] = need_by_variation.get(c.variation.id, 0) + c.order.quantity
        ctx_by_variation.setdefault(c.variation.id, c)

    assembled: list[BatchAssembledRow] = []
    skipped: list[BatchAssembleSkipped] = []
    any_success = False

    for variation_id, demand in need_by_variation.items():
        ctx = ctx_by_variation[variation_id]
        on_hand = max(0, finished_map.get(variation_id, 0))
        need = max(0, demand - on_hand)
        if need <= 0:
            continue
        assert ctx.design is not None  # guarded above

        blank = await blank_stock_service.get_or_create_blank_piece(
            db,
            company_id=company_id,
            spec_id=ctx.spec.id,
            size=ctx.variation.size,
            color=ctx.variation.color,
            color_code=ctx.variation.color_code,
        )
        transfer = await printed_transfer_service.get_or_create_printed_transfer(
            db, company_id=company_id, print_design_id=ctx.design.id, side=PrintSide.FRONT
        )
        try:
            run = await assembly_service.assemble_internal(
                db,
                company_id=company_id,
                user_id=user_id,
                payload=AssembleBody(
                    blank_piece_id=blank.id,
                    printed_transfer_id=transfer.id,
                    quantity=need,
                    batch_id=batch.id,
                ),
            )
        except ConflictError as exc:
            detail = str(getattr(exc, "detail", "")).lower()
            reason = "insufficient_printed" if "printed" in detail else "insufficient_blank"
            skipped.append(BatchAssembleSkipped(variation_id=variation_id, sku=ctx.variation.sku, reason=reason))
            continue
        assembled.append(BatchAssembledRow(variation_id=run.variation.id, sku=run.sku, quantity=run.quantity))
        any_success = True

    if any_success and batch.status == BatchStatus.OPEN:
        batch.status = BatchStatus.IN_PRODUCTION
        db.add(batch)
        await db.flush()

    if any_success:
        total_pieces = sum(r.quantity for r in assembled)
        await write_audit(
            db,
            company_id=company_id,
            user_id=user_id,
            resource_type=_RESOURCE,
            resource_id=batch.id,
            message=f"Assembled batch {batch.code} ({len(assembled)} SKUs, {total_pieces} pieces)",
        )
        await db.commit()
    else:
        await db.rollback()

    detail = await get_batch_detail(db, company_id=company_id, batch_id=batch_id)
    return BatchAssembleResult(batch=detail, assembled=assembled, skipped=skipped)


# --------------------------------------------------------------- ship (enviar)


async def ship_batch(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    batch_id: uuid.UUID,
) -> BatchDetailRead:
    """Ship the batch's orders (T6) and set status DISPATCHED (one transaction).

    Readiness-gated on CUMULATIVE demand: finished on-hand must cover the total
    quantity of every yet-to-ship member order per variation (orders sharing a
    SKU draw from the same stock, so a per-order check would under-count). If any
    variation is short → 409, nothing ships. Else each member order goes through
    :func:`order.ship_order_internal` (T6 guard + StockExit + status→SHIPPED,
    idempotent per order) and the batch transitions to DISPATCHED.
    """

    batch = await _get_batch(db, company_id=company_id, batch_id=batch_id)
    contexts = await _member_orders(db, company_id=company_id, batch_id=batch_id)
    if not contexts:
        raise ConflictError(detail="Batch has no orders to ship")

    # Ship is allowed from {open, in_production} — a fully-ready lote may ship
    # without first being montado (e.g. orders already covered by finished stock).
    if batch.status not in {BatchStatus.OPEN, BatchStatus.IN_PRODUCTION}:
        raise ConflictError(detail=f"Cannot dispatch batch from status {batch.status.value}")

    finished_map = await _finished_on_hand_map(
        db, company_id=company_id, variation_ids={c.variation.id for c in contexts}
    )
    # Cumulative demand per variation across the orders that still need shipping.
    demand_by_variation: dict[uuid.UUID, int] = {}
    for ctx in contexts:
        if ctx.order.status == OrderStatus.SHIPPED:
            continue
        demand_by_variation[ctx.variation.id] = demand_by_variation.get(ctx.variation.id, 0) + ctx.order.quantity
    if any(demand > max(0, finished_map.get(vid, 0)) for vid, demand in demand_by_variation.items()):
        raise ConflictError(detail="All orders must be ready (in finished stock) before shipping")

    shipped = 0
    for ctx in contexts:
        before = ctx.order.status
        await order_service.ship_order_internal(db, company_id=company_id, user_id=user_id, order=ctx.order)
        if before != OrderStatus.SHIPPED and ctx.order.status == OrderStatus.SHIPPED:
            shipped += 1

    previous = batch.status
    batch.status = BatchStatus.DISPATCHED
    db.add(batch)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=batch.id,
        message=f"Dispatched batch {batch.code} ({shipped} orders shipped, was {previous.value.upper()})",
    )
    await db.commit()

    return await get_batch_detail(db, company_id=company_id, batch_id=batch_id)


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
    "assemble_batch",
    "compute_estampa_grid",
    "create_batch",
    "delete_batch",
    "get_batch",
    "get_batch_detail",
    "list_batches",
    "ship_batch",
    "transition_status",
]
