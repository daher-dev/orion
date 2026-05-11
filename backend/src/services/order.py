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

from sqlalchemy import String, cast, func, or_
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    Ad,
    Client,
    Order,
    OrderStatus,
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


# A single loaded read row: the Order + its ad + variation + product +
# spec.code + client. Keep this as a plain tuple so the SQLModel rows stay
# pristine and the router builds the wire DTO.
OrderWithRelations = tuple[Order, Ad, ProductVariation, Product, str | None, Client]


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
)


def _base_select():
    return (
        select(*_BASE_SELECT_COLS)
        .join(Ad, Ad.id == Order.ad_id)
        .join(ProductVariation, ProductVariation.id == Order.variation_id)
        .join(Product, Product.id == ProductVariation.product_id)
        .join(ProductSpec, ProductSpec.id == Product.spec_id, isouter=True)
        .join(Client, Client.id == Order.client_id)
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


# ---------------------------------------------------------------------- list


async def list_orders(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: OrderFilters | None = None,
    page: PageParams | None = None,
) -> tuple[list[OrderWithRelations], int]:
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
        .join(Client, Client.id == Order.client_id)
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
    return rows, total  # type: ignore[return-value]


# ---------------------------------------------------------------------- get


async def get_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    order_id: uuid.UUID,
) -> OrderWithRelations:
    return await _load_with_relations(db, company_id=company_id, order_id=order_id)


# ------------------------------------------------------------------- create


async def create_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    payload: OrderCreate,
) -> OrderWithRelations:
    ad = await _ensure_ad(db, company_id=company_id, ad_id=payload.ad_id)
    variation = await _ensure_variation(db, company_id=company_id, variation_id=payload.variation_id)
    await _ensure_client(db, company_id=company_id, client_id=payload.client_id)

    # The variation must belong to the same product the ad points at. This
    # keeps reporting honest: an order on an Ad for product X cannot
    # decrement stock of product Y just because the operator picked the
    # wrong variation.
    if variation.product_id != ad.product_id:
        raise ValidationError(detail="Variation does not belong to the ad's product")

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
    return await _load_with_relations(db, company_id=company_id, order_id=order.id)


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
      variation (reason=sale, quantity=order.quantity). Skipped if an
      exit already exists for the order (idempotent retry safety).
    - ``returned``: insert a :class:`StockEntry` (source=return) to
      reverse the previous exit. Skipped if no exit was ever recorded.
    """

    if target == OrderStatus.SHIPPED:
        existing = await db.exec(select(func.count()).select_from(StockExit).where(StockExit.order_id == order.id))
        if int(existing.first() or 0) > 0:
            return
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
                shipment_id=None,
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
) -> OrderWithRelations:
    """Validated state transition with side effects on shipped/returned."""

    stmt = scoped(select(Order), Order, company_id).where(Order.id == order_id)
    order = (await db.exec(stmt)).first()
    if order is None:
        raise NotFoundError(detail="Order not found")

    _assert_valid_transition(order.status, target)
    if order.status == target:
        # No-op transition: still load and return the wire shape so the
        # caller sees a 200 with consistent payload semantics.
        return await _load_with_relations(db, company_id=company_id, order_id=order.id)

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
    return await _load_with_relations(db, company_id=company_id, order_id=order.id)


async def update_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    order_id: uuid.UUID,
    payload: OrderUpdate,
) -> OrderWithRelations:
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
    return await _load_with_relations(db, company_id=company_id, order_id=order.id)


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
    "OrderWithRelations",
    "create_order",
    "delete_order",
    "get_order",
    "list_orders",
    "transition_status",
    "update_order",
]
