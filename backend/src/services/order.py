"""Service layer for the Orders (Pedidos) feature.

Convention notes
----------------
- Every SELECT is :func:`scoped` to the active tenant.
- ``company_id`` is set explicitly on every insert.
- Mutations append an audit-log entry under the ``orders`` resource type.
- Status transitions write a human-readable message ("Marked order
  ORD-XXXX as PAID") so the audit timeline is legible.
- Transitioning to ``shipped`` creates a :class:`StockExit` row
  (reason=sale). Transitioning to ``returned`` creates a
  :class:`StockEntry` (source=return) to reverse the exit.
- DELETE is blocked when any ``StockExit`` references the order so we
  never orphan stock movements.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable
from typing import NamedTuple

from sqlalchemy import String, cast, func, or_
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    Ad,
    AdProduct,
    Client,
    ImportedOrder,
    Order,
    OrderItem,
    OrderStatus,
    PrintDesign,
    Product,
    ProductSpec,
    ProductVariation,
    StockEntry,
    StockExit,
    StockExitReason,
    StockSource,
)
from schemas._common import PageParams
from schemas.order import OrderCreate, OrderFilters, OrderUpdate
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError, ValidationError

_RESOURCE = "orders"


# Readiness extras computed alongside the joined read rows. ``ready`` is the
# prototype's ``orderReady`` (finished stock covers the full quantity);
# ``on_hand`` is the finished on-hand for the order's variation (lets the board
# draw the ready/total bar); ``has_unmapped_items`` is true when the order has
# any ``OrderItem`` whose ``variation_id`` is still NULL (awaiting De/Para).
class OrderReadiness(NamedTuple):
    ready: bool
    on_hand: int
    has_unmapped_items: bool


# A single loaded read row: the Order + its ad + variation + product +
# spec.code + client. Keep this as a plain tuple so the SQLModel rows stay
# pristine and the router builds the wire DTO.
OrderWithRelations = tuple[Order, Ad, ProductVariation, Product, str | None, Client | None]


# --------------------------------------------------------------------- helpers


def _short_code(value: uuid.UUID) -> str:
    """Compact human code used in audit messages and the UI.

    Format: ``ORD-XXXXXXXX`` where ``X`` is the first 8 uppercase hex chars
    of the uuid. Stable, predictable, and short enough to fit in a table.
    """

    return f"ORD-{value.hex[:8].upper()}"


def _apply_filters(stmt, filters: OrderFilters):
    if filters.q:
        like = f"%{filters.q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Client.name).like(like),
                func.lower(Product.name).like(like),
                func.lower(Ad.title).like(like),
                func.lower(Order.external_order_id).like(like),
                func.lower(cast(Order.id, String)).like(like),
            )
        )
    if filters.status is not None:
        stmt = stmt.where(Order.status == filters.status)
    if filters.channel is not None:
        stmt = stmt.where(Ad.ecommerce == filters.channel)
    if filters.client_id is not None:
        stmt = stmt.where(Order.client_id == filters.client_id)
    if filters.ad_id is not None:
        stmt = stmt.where(Order.ad_id == filters.ad_id)
    if filters.date_from is not None:
        stmt = stmt.where(Order.ordered_at >= filters.date_from)
    if filters.date_to is not None:
        stmt = stmt.where(Order.ordered_at <= filters.date_to)
    if filters.unbatched:
        stmt = stmt.where(Order.batch_id.is_(None))  # type: ignore[union-attr]
    if filters.batch_id is not None:
        stmt = stmt.where(Order.batch_id == filters.batch_id)
    if filters.product_id is not None:
        # ProductVariation is already joined in both the rows and count selects.
        stmt = stmt.where(ProductVariation.product_id == filters.product_id)
    return stmt


# ------------------------------------------------------- reference checks


async def _ensure_ad(db: AsyncSession, *, company_id: uuid.UUID, ad_id: uuid.UUID) -> Ad:
    stmt = scoped(select(Ad), Ad, company_id).where(Ad.id == ad_id)
    ad = (await db.exec(stmt)).first()
    if ad is None:
        raise ValidationError(detail="Ad not found for this company")
    return ad


async def _ensure_variation(db: AsyncSession, *, company_id: uuid.UUID, variation_id: uuid.UUID) -> ProductVariation:
    stmt = scoped(select(ProductVariation), ProductVariation, company_id).where(ProductVariation.id == variation_id)
    variation = (await db.exec(stmt)).first()
    if variation is None:
        raise ValidationError(detail="Variation not found for this company")
    return variation


async def _ensure_client(db: AsyncSession, *, company_id: uuid.UUID, client_id: uuid.UUID) -> Client:
    stmt = scoped(select(Client), Client, company_id).where(Client.id == client_id)
    client = (await db.exec(stmt)).first()
    if client is None:
        raise ValidationError(detail="Client not found for this company")
    return client


# ----------------------------------------------------- joined fetch helpers


_BASE_SELECT_COLS = (
    Order,
    Ad,
    ProductVariation,
    Product,
    ProductSpec.code,
    Client,
    PrintDesign.image_url,
    # Fulfillment artifacts from the marketplace import (1:1, may be absent).
    ImportedOrder.shipping_label_url,
    ImportedOrder.tracking_code,
)

OrderWithRelations = tuple[
    Order,
    Ad,
    ProductVariation,
    Product,
    str | None,
    Client | None,
    str | None,
    str | None,
    str | None,
]


def _base_select():
    return (
        select(*_BASE_SELECT_COLS)
        .join(Ad, Ad.id == Order.ad_id)
        .join(ProductVariation, ProductVariation.id == Order.variation_id)
        .join(Product, Product.id == ProductVariation.product_id)
        .join(ProductSpec, ProductSpec.id == Product.spec_id, isouter=True)
        .join(PrintDesign, PrintDesign.id == Product.print_id, isouter=True)
        # Outer: marketplace-imported orders have no client.
        .join(Client, Client.id == Order.client_id, isouter=True)
        # Outer: only marketplace-imported orders have a companion row.
        .join(ImportedOrder, ImportedOrder.order_id == Order.id, isouter=True)
    )


async def _load_with_relations(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    order_id: uuid.UUID,
) -> OrderWithRelations:
    stmt = _base_select().where(Order.company_id == company_id, Order.id == order_id)
    row = (await db.exec(stmt)).first()
    if row is None:
        raise NotFoundError(detail="Order not found")
    return row  # type: ignore[return-value]


# ------------------------------------------------------------- readiness extras


async def _finished_on_hand_map(
    db: AsyncSession, *, company_id: uuid.UUID, variation_ids: set[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """``{variation_id: on_hand}`` (entries - exits) for the given variations.

    Two grouped aggregates filtered to the set — the same no-N+1 shape used by
    ``planning._finished_on_hand_map`` / ``stock.list_stock_levels``. Missing
    keys default to 0 at the call site.
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


async def _unmapped_order_ids(db: AsyncSession, *, company_id: uuid.UUID, order_ids: set[uuid.UUID]) -> set[uuid.UUID]:
    """Subset of ``order_ids`` that have ≥1 ``OrderItem`` with ``variation_id`` NULL.

    One grouped query over the page's order ids — these orders sit in the
    Mapeamento board column and are blocked from Separação until vinculados.
    """

    if not order_ids:
        return set()

    stmt = (
        select(OrderItem.order_id)
        .where(
            OrderItem.company_id == company_id,
            OrderItem.order_id.in_(order_ids),  # type: ignore[union-attr]
            OrderItem.variation_id.is_(None),  # type: ignore[union-attr]
        )
        .group_by(OrderItem.order_id)
    )
    return {row for row in (await db.exec(stmt)).all()}


def _readiness_for(
    order: Order,
    *,
    finished_map: dict[uuid.UUID, int],
    unmapped_ids: set[uuid.UUID],
) -> OrderReadiness:
    on_hand = max(0, finished_map.get(order.variation_id, 0))
    return OrderReadiness(
        ready=on_hand >= order.quantity,
        on_hand=on_hand,
        has_unmapped_items=order.id in unmapped_ids,
    )


# ---------------------------------------------------------------------- list


async def list_orders(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: OrderFilters | None = None,
    page: PageParams | None = None,
) -> tuple[list[OrderWithRelations], int, dict[uuid.UUID, OrderReadiness]]:
    filters = filters or OrderFilters()
    page = page or PageParams()

    base = _base_select().where(Order.company_id == company_id)
    base = _apply_filters(base, filters)

    count_stmt = (
        select(func.count())
        .select_from(Order)
        .join(Ad, Ad.id == Order.ad_id)
        .join(ProductVariation, ProductVariation.id == Order.variation_id)
        .join(Product, Product.id == ProductVariation.product_id)
        .join(Client, Client.id == Order.client_id, isouter=True)
        .where(Order.company_id == company_id)
    )
    count_stmt = _apply_filters(count_stmt, filters)
    total = int((await db.exec(count_stmt)).one() or 0)

    rows_stmt = (
        base.order_by(Order.ordered_at.desc(), Order.created_at.desc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    rows = list((await db.exec(rows_stmt)).all())

    # Readiness extras computed for the page's orders in TWO grouped queries
    # (no per-order N+1): finished on-hand over the page's variation set + the
    # set of orders with any unmapped piece.
    orders = [row[0] for row in rows]
    variation_ids = {o.variation_id for o in orders}
    order_ids = {o.id for o in orders}
    finished_map = await _finished_on_hand_map(db, company_id=company_id, variation_ids=variation_ids)
    unmapped_ids = await _unmapped_order_ids(db, company_id=company_id, order_ids=order_ids)
    readiness = {o.id: _readiness_for(o, finished_map=finished_map, unmapped_ids=unmapped_ids) for o in orders}
    return rows, total, readiness  # type: ignore[return-value]


# ---------------------------------------------------------------------- get


async def get_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    order_id: uuid.UUID,
) -> tuple[OrderWithRelations, OrderReadiness]:
    row = await _load_with_relations(db, company_id=company_id, order_id=order_id)
    order: Order = row[0]
    finished_map = await _finished_on_hand_map(db, company_id=company_id, variation_ids={order.variation_id})
    unmapped_ids = await _unmapped_order_ids(db, company_id=company_id, order_ids={order.id})
    return row, _readiness_for(order, finished_map=finished_map, unmapped_ids=unmapped_ids)


# ------------------------------------------------------------------- create


async def _load_with_readiness(
    db: AsyncSession, *, company_id: uuid.UUID, order_id: uuid.UUID
) -> tuple[OrderWithRelations, OrderReadiness]:
    """Load the joined read row + its readiness extras (single-order path)."""

    return await get_order(db, company_id=company_id, order_id=order_id)


async def create_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    payload: OrderCreate,
) -> tuple[OrderWithRelations, OrderReadiness]:
    ad = await _ensure_ad(db, company_id=company_id, ad_id=payload.ad_id)
    variation = await _ensure_variation(db, company_id=company_id, variation_id=payload.variation_id)
    await _ensure_client(db, company_id=company_id, client_id=payload.client_id)

    # The variation must belong to one of the products the ad lists. This
    # keeps reporting honest: an order on an Ad cannot decrement stock of a
    # product the listing doesn't even sell.
    ad_product_ids = set(
        (
            await db.exec(
                select(AdProduct.product_id).where(AdProduct.ad_id == ad.id, AdProduct.company_id == company_id)
            )
        ).all()
    )
    if variation.product_id not in ad_product_ids:
        raise ValidationError(detail="Variation does not belong to any of the ad's products")

    order = Order(
        company_id=company_id,
        ad_id=payload.ad_id,
        variation_id=payload.variation_id,
        client_id=payload.client_id,
        quantity=payload.quantity,
        sale_price=payload.sale_price,
        ordered_at=payload.ordered_at,
        external_order_id=payload.external_order_id,
        status=OrderStatus.PENDING,
    )
    db.add(order)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError(detail="external_order_id already exists for this ad") from exc

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=order.id,
        message=f"Created order {_short_code(order.id)}",
    )
    await db.commit()
    return await _load_with_readiness(db, company_id=company_id, order_id=order.id)


# ------------------------------------------------------------------- update


# Valid forward transitions. Cancel + return are folded in by the
# transition helper below — any non-final state can become CANCELLED, and
# anything past PAID can become RETURNED.
_FORWARD: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PENDING: {OrderStatus.PAID, OrderStatus.CANCELLED},
    OrderStatus.PAID: {OrderStatus.SHIPPED, OrderStatus.CANCELLED, OrderStatus.RETURNED},
    OrderStatus.SHIPPED: {OrderStatus.DELIVERED, OrderStatus.RETURNED},
    OrderStatus.DELIVERED: {OrderStatus.RETURNED},
    OrderStatus.CANCELLED: set(),
    OrderStatus.RETURNED: set(),
}


def _allowed_transitions(current: OrderStatus) -> Iterable[OrderStatus]:
    return _FORWARD.get(current, set())


def _assert_valid_transition(current: OrderStatus, target: OrderStatus) -> None:
    if current == target:
        return
    if target not in _allowed_transitions(current):
        raise ConflictError(
            detail=f"Cannot transition order status from {current.value} to {target.value}",
        )


async def _order_has_exit(db: AsyncSession, *, order_id: uuid.UUID) -> bool:
    existing = await db.exec(select(func.count()).select_from(StockExit).where(StockExit.order_id == order_id))
    return int(existing.first() or 0) > 0


async def _write_sale_exit(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    order: Order,
) -> None:
    """T6 finished-stock debit for a shipped order — guarded + idempotent.

    - Idempotent: no-op if a :class:`StockExit` already references the order
      (re-ship safety — never re-debits).
    - On-hand guard (counted tier): computes live finished on-hand for the
      order's variation and raises :class:`ConflictError` (409) when it cannot
      cover ``order.quantity`` — finished product can never be driven negative.
    - Provenance: ``reason=sale, order_id, variation_id, quantity``.

    Caller owns the transaction (flush only — no commit here).
    """

    if await _order_has_exit(db, order_id=order.id):
        return

    from services import stock as stock_service

    on_hand = await stock_service._compute_on_hand(db, company_id=company_id, variation_id=order.variation_id)
    if on_hand < order.quantity:
        raise ConflictError(detail=f"Insufficient finished stock to ship — available: {on_hand}")

    db.add(
        StockExit(
            company_id=company_id,
            variation_id=order.variation_id,
            order_id=order.id,
            quantity=order.quantity,
            reason=StockExitReason.SALE,
            notes=f"Auto from order {_short_code(order.id)}",
        )
    )
    await db.flush()


async def _apply_status_side_effects(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    order: Order,
    target: OrderStatus,
) -> None:
    """Side effects executed when transitioning into terminal/stock-moving
    statuses.

    - ``shipped``: insert a single :class:`StockExit` for the order's
      variation (reason=sale, quantity=order.quantity), guarded against
      insufficient finished stock (409) and idempotent on re-ship. See
      :func:`_write_sale_exit`.
    - ``returned``: insert a :class:`StockEntry` (source=return) to
      reverse the previous exit. Skipped if no exit was ever recorded.
    """

    if target == OrderStatus.SHIPPED:
        await _write_sale_exit(db, company_id=company_id, order=order)
    elif target == OrderStatus.RETURNED:
        # If the order never shipped (cancelled-from-paid path) there is
        # nothing to reverse and we skip the StockEntry.
        had_exit = await db.exec(select(func.count()).select_from(StockExit).where(StockExit.order_id == order.id))
        if int(had_exit.first() or 0) <= 0:
            return
        db.add(
            StockEntry(
                company_id=company_id,
                variation_id=order.variation_id,
                quantity=order.quantity,
                source=StockSource.RETURN,
                notes=f"Return for order {_short_code(order.id)}",
            )
        )


async def transition_status(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    order_id: uuid.UUID,
    target: OrderStatus,
) -> tuple[OrderWithRelations, OrderReadiness]:
    """Validated state transition with side effects on shipped/returned."""

    stmt = scoped(select(Order), Order, company_id).where(Order.id == order_id)
    order = (await db.exec(stmt)).first()
    if order is None:
        raise NotFoundError(detail="Order not found")

    _assert_valid_transition(order.status, target)
    if order.status == target:
        # No-op transition: still load and return the wire shape so the
        # caller sees a 200 with consistent payload semantics.
        return await _load_with_readiness(db, company_id=company_id, order_id=order.id)

    await _apply_status_side_effects(
        db,
        company_id=company_id,
        order=order,
        target=target,
    )

    previous = order.status
    order.status = target
    db.add(order)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=order.id,
        message=(f"Marked order {_short_code(order.id)} as {target.value.upper()} (was {previous.value.upper()})"),
    )
    await db.commit()
    return await _load_with_readiness(db, company_id=company_id, order_id=order.id)


# A status from which the lote-ship path may fulfill (ship implies fulfillment
# regardless of payment bookkeeping). Shipping from PENDING or PAID is allowed;
# already-terminal / shipped / delivered orders are rejected.
_SHIPPABLE_FROM: frozenset[OrderStatus] = frozenset({OrderStatus.PENDING, OrderStatus.PAID})


async def ship_order_internal(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    order: Order,
) -> None:
    """Ship ONE order (T6) WITHOUT committing — the lote-ship caller owns the tx.

    Idempotent at the order grain: a no-op if the order is already SHIPPED or
    already carries a :class:`StockExit` (defensive). For a shippable order it
    runs the T6 guard + writes the sale exit (:func:`_write_sale_exit`), flips
    the status to SHIPPED, and writes one audit entry. Unlike
    :func:`transition_status` it permits shipping from ``{PENDING, PAID}`` (ship
    implies fulfillment) and rejects CANCELLED / RETURNED / DELIVERED /
    already-SHIPPED with a :class:`ConflictError`.
    """

    if order.status == OrderStatus.SHIPPED or await _order_has_exit(db, order_id=order.id):
        return

    if order.status not in _SHIPPABLE_FROM:
        raise ConflictError(detail=f"Cannot ship order {_short_code(order.id)} from status {order.status.value}")

    await _write_sale_exit(db, company_id=company_id, order=order)

    previous = order.status
    order.status = OrderStatus.SHIPPED
    db.add(order)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=order.id,
        message=(f"Marked order {_short_code(order.id)} as SHIPPED (was {previous.value.upper()})"),
    )


async def update_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    order_id: uuid.UUID,
    payload: OrderUpdate,
) -> tuple[OrderWithRelations, OrderReadiness]:
    stmt = scoped(select(Order), Order, company_id).where(Order.id == order_id)
    order = (await db.exec(stmt)).first()
    if order is None:
        raise NotFoundError(detail="Order not found")

    data = payload.model_dump(exclude_unset=True)
    audit_messages: list[str] = []

    if "status" in data and data["status"] is not None:
        target = OrderStatus(data["status"])
        _assert_valid_transition(order.status, target)
        if target != order.status:
            await _apply_status_side_effects(
                db,
                company_id=company_id,
                order=order,
                target=target,
            )
            audit_messages.append(
                f"Marked order {_short_code(order.id)} as {target.value.upper()} (was {order.status.value.upper()})"
            )
            order.status = target

    for field in ("sale_price", "ordered_at", "external_order_id", "quantity"):
        if field in data:
            setattr(order, field, data[field])
            audit_messages.append(
                f"Edited order {_short_code(order.id)} field {field}",
            )

    db.add(order)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError(detail="external_order_id already exists for this ad") from exc

    if not audit_messages:
        audit_messages.append(f"Edited order {_short_code(order.id)}")

    for message in audit_messages:
        await write_audit(
            db,
            company_id=company_id,
            user_id=user_id,
            resource_type=_RESOURCE,
            resource_id=order.id,
            message=message,
        )

    await db.commit()
    return await _load_with_readiness(db, company_id=company_id, order_id=order.id)


# ------------------------------------------------------------------- delete


async def delete_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    order_id: uuid.UUID,
) -> None:
    stmt = scoped(select(Order), Order, company_id).where(Order.id == order_id)
    order = (await db.exec(stmt)).first()
    if order is None:
        raise NotFoundError(detail="Order not found")

    linked = await db.exec(select(func.count()).select_from(StockExit).where(StockExit.order_id == order.id))
    if int(linked.first() or 0) > 0:
        raise ConflictError(
            detail="Cannot delete order — stock has already moved",
        )

    code = _short_code(order.id)
    await db.delete(order)
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=order_id,
        message=f"Deleted order {code}",
    )
    await db.commit()


__all__ = [
    "OrderReadiness",
    "OrderWithRelations",
    "create_order",
    "delete_order",
    "get_order",
    "list_orders",
    "ship_order_internal",
    "transition_status",
    "update_order",
]
