"""Service layer for the Dashboard summary (FEATURE-015).

Read-only — every query aggregates over existing tenant-scoped tables.
The single public entry point is :func:`get_summary`, which returns a
fully populated :class:`DashboardSummary` ready to be sent on the wire.

The dashboard is centred on the daily *conferência*. It surfaces: the
conference totals (with the order-level checked classification), the Top-5
products ranking, the operational follow-up lists (needs-action + activity),
and the operator (factory-floor) section.

Aggregation conventions
-----------------------
- All ``SELECT`` calls are tenant-scoped through ``scoped()``.
- We avoid an N+1 by computing the activity feed via a single joined
  ``select(AuditLog, User)`` (same pattern as the audit-log viewer).
- Threshold for "stock_low": variations with on-hand ≤ the configured
  threshold (per-variation override, else the company-wide
  ``Company.low_stock_threshold``, else ``DEFAULT_LOW_STOCK_THRESHOLD``)
  AND at least one historical movement (we don't want to surface "empty
  ledger" SKUs as low).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import String, case, cast, func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    Ad,
    AuditLog,
    Company,
    CuttingOrder,
    CuttingOrderOutput,
    CuttingStatus,
    FabricRoll,
    ImportedOrder,
    Order,
    OrderItem,
    OrderStatus,
    PrintDesign,
    Product,
    ProductSpec,
    ProductVariation,
    SeparationStatus,
    SewingShipment,
    ShipmentStatus,
    StockEntry,
    StockExit,
    User,
)
from schemas.dashboard import (
    ActivityItem,
    ConferenceSummary,
    ConferenceTotals,
    DashboardSummary,
    NeedsActionItem,
    OperatorCut,
    OperatorSummary,
    TopProduct,
)
from services._base import scoped

#: Default stock threshold used to decide whether a SKU is "low" when a company
#: has not configured its own (and as the fallback for NULL per-variation
#: overrides). Mirrors ``Company.low_stock_threshold``'s server_default.
DEFAULT_LOW_STOCK_THRESHOLD = 10

#: Maximum number of audit rows surfaced in the activity feed.
ACTIVITY_LIMIT = 20

#: How many top items to surface in the needs-action list.
NEEDS_ACTION_LIMIT = 5

#: How many products to surface in the Top-5 ranking.
TOP_PRODUCTS_LIMIT = 5

#: How many cutting orders to surface in the operator queue.
OPERATOR_QUEUE_LIMIT = 5


# --------------------------------------------------------------------------- utilities


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _utc_today_bounds() -> tuple[datetime, datetime]:
    """Return ``[start_of_today, start_of_tomorrow)`` in UTC."""
    today = _utc_now().date()
    start = datetime.combine(today, datetime.min.time(), tzinfo=UTC)
    return start, start + timedelta(days=1)


# --------------------------------------------------------------------------- KPI helpers


async def _count_orders_with_status(db: AsyncSession, *, company_id: uuid.UUID, status: OrderStatus) -> int:
    stmt = scoped(
        select(func.count()).select_from(Order),
        Order,
        company_id,
    ).where(Order.status == status)
    return int((await db.exec(stmt)).first() or 0)


async def _count_cutting_in_progress(db: AsyncSession, *, company_id: uuid.UUID) -> int:
    stmt = scoped(
        select(func.count()).select_from(CuttingOrder),
        CuttingOrder,
        company_id,
    ).where(CuttingOrder.status.in_((CuttingStatus.PENDING, CuttingStatus.CUTTING)))  # type: ignore[attr-defined]
    return int((await db.exec(stmt)).first() or 0)


async def _count_sewing_active(db: AsyncSession, *, company_id: uuid.UUID) -> int:
    stmt = scoped(
        select(func.count()).select_from(SewingShipment),
        SewingShipment,
        company_id,
    ).where(SewingShipment.status.in_((ShipmentStatus.SENT, ShipmentStatus.PARTIAL)))  # type: ignore[attr-defined]
    return int((await db.exec(stmt)).first() or 0)


async def _on_hand_per_variation(db: AsyncSession, *, company_id: uuid.UUID) -> dict[uuid.UUID, int]:
    """Return a ``{variation_id: on_hand}`` map for every variation that has
    moved at least once. Variations with no history are omitted.

    We compute entries and exits separately and merge in Python — keeps the
    query simple and works regardless of which side has rows.
    """

    entries_stmt = scoped(
        select(
            StockEntry.variation_id,
            func.coalesce(func.sum(StockEntry.quantity), 0).label("total"),
        ),
        StockEntry,
        company_id,
    ).group_by(StockEntry.variation_id)
    exits_stmt = scoped(
        select(
            StockExit.variation_id,
            func.coalesce(func.sum(StockExit.quantity), 0).label("total"),
        ),
        StockExit,
        company_id,
    ).group_by(StockExit.variation_id)
    levels: dict[uuid.UUID, int] = {}
    for variation_id, total in (await db.exec(entries_stmt)).all():
        levels[variation_id] = int(total or 0)
    for variation_id, total in (await db.exec(exits_stmt)).all():
        levels[variation_id] = levels.get(variation_id, 0) - int(total or 0)
    return levels


async def _company_threshold(db: AsyncSession, *, company_id: uuid.UUID) -> int:
    """Return the company-wide low-stock threshold (default if unset)."""

    stmt = select(Company.low_stock_threshold).where(Company.id == company_id)
    value = (await db.exec(stmt)).first()
    return int(value) if value is not None else DEFAULT_LOW_STOCK_THRESHOLD


async def _variation_threshold_overrides(db: AsyncSession, *, company_id: uuid.UUID) -> dict[uuid.UUID, int]:
    """Return ``{variation_id: low_stock_threshold}`` for variations that set an
    explicit override. Variations inheriting the company default are omitted.

    A single tenant-scoped query keeps this consistent with the file's no-N+1
    convention.
    """

    stmt = scoped(
        select(ProductVariation.id, ProductVariation.low_stock_threshold),
        ProductVariation,
        company_id,
    ).where(ProductVariation.low_stock_threshold.is_not(None))  # type: ignore[union-attr]
    return {variation_id: int(threshold) for variation_id, threshold in (await db.exec(stmt)).all()}


def _count_low_stock(
    levels: dict[uuid.UUID, int],
    *,
    company_threshold: int,
    overrides: dict[uuid.UUID, int],
) -> int:
    """Count SKUs whose on-hand is at or below their effective threshold.

    The effective threshold is the per-variation override when present, else the
    company-wide default.
    """

    return sum(1 for variation_id, value in levels.items() if value <= overrides.get(variation_id, company_threshold))


# --------------------------------------------------------------------------- top products


async def _top_products(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    since: datetime | None = None,
    limit: int = TOP_PRODUCTS_LIMIT,
) -> list[TopProduct]:
    """Top *designs* by pieces in the order book (``status != cancelled``).

    Mirrors the legacy Base44 homepage ranking: orders group by the mapped
    *estampa* (print design name), falling back to the ad title when an order
    carries no print — the same ``estampa_mapeada || titulo_anuncio`` grouping.
    The thumbnail is a representative **marketplace listing photo** (the order's
    ``foto_url`` — the exact image Base44's homepage shows, served from the
    marketplace CDN so it survives Base44 being retired), falling back to the
    design artwork only when no order in the group carries a photo. ``orders``
    counts distinct marketplace orders (one external order number can span
    several line items); ``pieces`` sums ``Order.quantity``.
    """

    label = func.coalesce(PrintDesign.name, Ad.title)
    image = func.max(func.coalesce(func.nullif(ImportedOrder.image_url, ""), func.nullif(PrintDesign.image_url, "")))
    order_no = func.coalesce(Order.external_order_id, cast(Order.id, String))
    stmt = scoped(
        select(
            label.label("name"),
            image.label("image_url"),
            func.coalesce(func.sum(Order.quantity), 0).label("pieces"),
            func.count(func.distinct(order_no)).label("orders"),
        )
        .join(ProductVariation, ProductVariation.id == Order.variation_id)
        .join(Product, Product.id == ProductVariation.product_id)
        .join(Ad, Ad.id == Order.ad_id)
        .outerjoin(PrintDesign, PrintDesign.id == Product.print_id)
        .outerjoin(ImportedOrder, ImportedOrder.order_id == Order.id),
        Order,
        company_id,
    ).where(Order.status != OrderStatus.CANCELLED)
    if since is not None:
        stmt = stmt.where(Order.ordered_at >= since)
    stmt = stmt.group_by(label).order_by(func.sum(Order.quantity).desc()).limit(limit)
    rows = (await db.exec(stmt)).all()
    return [
        TopProduct(
            name=row.name or "—",
            image_url=row.image_url or None,
            pieces=int(row.pieces or 0),
            orders=int(row.orders or 0),
        )
        for row in rows
    ]


# --------------------------------------------------------------------------- needs action


async def _needs_action(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    company_threshold: int,
    threshold_overrides: dict[uuid.UUID, int],
) -> list[NeedsActionItem]:
    items: list[NeedsActionItem] = []

    pending_orders = await _count_orders_with_status(db, company_id=company_id, status=OrderStatus.PENDING)
    if pending_orders > 0:
        pedido = "pedido" if pending_orders == 1 else "pedidos"
        items.append(
            NeedsActionItem(
                kind="orders_pending",
                message=f"{pending_orders} {pedido} pendente{'s' if pending_orders != 1 else ''} de pagamento",
                link="/orders?status=pending",
            )
        )

    levels = await _on_hand_per_variation(db, company_id=company_id)
    low = _count_low_stock(levels, company_threshold=company_threshold, overrides=threshold_overrides)
    if low > 0:
        items.append(
            NeedsActionItem(
                kind="stock_low",
                message=f"{low} SKU{'s' if low != 1 else ''} com saldo baixo",
                link="/stock",
            )
        )

    # Sewing shipments older than 14 days that are still out.
    overdue_bound = _utc_now() - timedelta(days=14)
    overdue_stmt = scoped(
        select(func.count()).select_from(SewingShipment),
        SewingShipment,
        company_id,
    ).where(
        SewingShipment.status.in_((ShipmentStatus.SENT, ShipmentStatus.PARTIAL)),  # type: ignore[attr-defined]
        SewingShipment.created_at <= overdue_bound,  # type: ignore[attr-defined]
    )
    overdue = int((await db.exec(overdue_stmt)).first() or 0)
    if overdue > 0:
        remessa = "remessa" if overdue == 1 else "remessas"
        items.append(
            NeedsActionItem(
                kind="sewing_overdue",
                message=f"{overdue} {remessa} em atraso na banca",
                link="/sewing",
            )
        )

    # Fabric rolls running thin (≤ 5kg).
    fabric_stmt = scoped(
        select(func.count()).select_from(FabricRoll),
        FabricRoll,
        company_id,
    ).where(FabricRoll.current_weight_kg <= Decimal("5"))
    fabric_low = int((await db.exec(fabric_stmt)).first() or 0)
    if fabric_low > 0:
        rolo = "rolo" if fabric_low == 1 else "rolos"
        items.append(
            NeedsActionItem(
                kind="fabric_low",
                message=f"{fabric_low} {rolo} de tecido com estoque baixo",
                link="/fabric",
            )
        )

    return items[:NEEDS_ACTION_LIMIT]


# --------------------------------------------------------------------------- activity


async def _activity(db: AsyncSession, *, company_id: uuid.UUID) -> list[ActivityItem]:
    stmt = (
        scoped(
            select(AuditLog, User).join(User, User.id == AuditLog.user_id, isouter=True),
            AuditLog,
            company_id,
        )
        .order_by(AuditLog.created_at.desc())  # type: ignore[attr-defined]
        .limit(ACTIVITY_LIMIT)
    )
    rows = (await db.exec(stmt)).all()
    items: list[ActivityItem] = []
    for audit, user in rows:
        items.append(
            ActivityItem(
                id=audit.id,
                when=audit.created_at,
                who=user.name if user is not None else None,
                message=audit.message,
                resource_type=audit.resource_type,
                resource_id=audit.resource_id,
            )
        )
    return items


# --------------------------------------------------------------------------- conference


async def _order_piece_counts(
    db: AsyncSession, *, company_id: uuid.UUID, since: datetime | None = None
) -> dict[str, int]:
    """``{mapped, pending, pieces_checked}`` over the items of non-cancelled
    orders (single aggregate query).

    Joins ``Order`` and excludes ``CANCELLED`` so these piece counters stay
    consistent with ``orders``/``pieces`` and the order-level classification —
    otherwise a cancelled order's items would inflate ``mapped``/``pending`` and
    skew ``mapped_pct`` against an order count that excludes them.
    """

    mapped_flag = case((OrderItem.variation_id.is_not(None), 1), else_=0)  # type: ignore[union-attr]
    pending_flag = case((OrderItem.variation_id.is_(None), 1), else_=0)  # type: ignore[union-attr]
    checked_flag = case((OrderItem.status == SeparationStatus.CHECKED, 1), else_=0)
    stmt = scoped(
        select(
            func.coalesce(func.sum(mapped_flag), 0),
            func.coalesce(func.sum(pending_flag), 0),
            func.coalesce(func.sum(checked_flag), 0),
        ).join(Order, Order.id == OrderItem.order_id),
        OrderItem,
        company_id,
    ).where(Order.status != OrderStatus.CANCELLED)
    if since is not None:
        stmt = stmt.where(Order.ordered_at >= since)
    mapped, pending, pieces_checked = (await db.exec(stmt)).one()
    return {
        "mapped": int(mapped or 0),
        "pending": int(pending or 0),
        "pieces_checked": int(pieces_checked or 0),
    }


async def _order_totals(db: AsyncSession, *, company_id: uuid.UUID, since: datetime | None = None) -> dict[str, int]:
    """``{orders, pieces, in_lote}`` — scope = orders with ``status != cancelled``."""

    totals_stmt = scoped(
        select(func.count(), func.coalesce(func.sum(Order.quantity), 0)),
        Order,
        company_id,
    ).where(Order.status != OrderStatus.CANCELLED)
    if since is not None:
        totals_stmt = totals_stmt.where(Order.ordered_at >= since)
    orders_count, pieces = (await db.exec(totals_stmt)).one()

    in_lote_stmt = scoped(
        select(func.count()).select_from(Order),
        Order,
        company_id,
    ).where(
        Order.status != OrderStatus.CANCELLED,
        Order.batch_id.is_not(None),  # type: ignore[union-attr]
    )
    if since is not None:
        in_lote_stmt = in_lote_stmt.where(Order.ordered_at >= since)
    in_lote = int((await db.exec(in_lote_stmt)).first() or 0)

    return {"orders": int(orders_count or 0), "pieces": int(pieces or 0), "in_lote": in_lote}


async def _order_checked_classification(
    db: AsyncSession, *, company_id: uuid.UUID, total_orders: int, since: datetime | None = None
) -> dict[str, int]:
    """Bucket every non-cancelled order by how many of its items are checked.

    Returns ``{orders_checked, orders_partial, orders_untouched}`` where the
    three sum to ``total_orders`` (orders with no items yet count as untouched).
    """

    checked_flag = case((OrderItem.status == SeparationStatus.CHECKED, 1), else_=0)
    stmt = (
        scoped(
            select(
                func.count().label("total"),
                func.coalesce(func.sum(checked_flag), 0).label("checked"),
            ).join(Order, Order.id == OrderItem.order_id),
            OrderItem,
            company_id,
        )
        .where(Order.status != OrderStatus.CANCELLED)
        .group_by(OrderItem.order_id)
    )
    if since is not None:
        stmt = stmt.where(Order.ordered_at >= since)
    rows = (await db.exec(stmt)).all()
    orders_checked = orders_partial = with_items_untouched = 0
    for total, checked in rows:
        total = int(total or 0)
        checked = int(checked or 0)
        if total > 0 and checked >= total:
            orders_checked += 1
        elif checked > 0:
            orders_partial += 1
        else:
            with_items_untouched += 1
    # Orders that have no items yet are not in ``rows`` — treat them as untouched.
    orders_untouched = with_items_untouched + max(0, total_orders - len(rows))
    return {
        "orders_checked": orders_checked,
        "orders_partial": orders_partial,
        "orders_untouched": orders_untouched,
    }


async def _conference(db: AsyncSession, *, company_id: uuid.UUID, since: datetime | None = None) -> ConferenceSummary:
    pieces = await _order_piece_counts(db, company_id=company_id, since=since)
    totals = await _order_totals(db, company_id=company_id, since=since)
    classification = await _order_checked_classification(
        db, company_id=company_id, total_orders=totals["orders"], since=since
    )

    map_denom = pieces["mapped"] + pieces["pending"]
    mapped_pct = round(100 * pieces["mapped"] / map_denom) if map_denom else 100

    return ConferenceSummary(
        totals=ConferenceTotals(
            orders=totals["orders"],
            pieces=totals["pieces"],
            mapped=pieces["mapped"],
            pending=pieces["pending"],
            mapped_pct=mapped_pct,
            in_lote=totals["in_lote"],
            orders_checked=classification["orders_checked"],
            orders_partial=classification["orders_partial"],
            orders_untouched=classification["orders_untouched"],
            pieces_checked=pieces["pieces_checked"],
        ),
    )


# --------------------------------------------------------------------------- operator


async def _pieces_cut_today(db: AsyncSession, *, company_id: uuid.UUID) -> int:
    """Sum of cutting outputs whose order was cut today (a real "produced today").

    ``CuttingOrderOutput`` is not company-scoped itself — we scope through the
    joined ``CuttingOrder``.
    """

    start, end = _utc_today_bounds()
    stmt = scoped(
        select(func.coalesce(func.sum(CuttingOrderOutput.quantity), 0)).join(
            CuttingOrder, CuttingOrder.id == CuttingOrderOutput.cutting_order_id
        ),
        CuttingOrder,
        company_id,
    ).where(
        CuttingOrder.cut_at.is_not(None),  # type: ignore[attr-defined]
        CuttingOrder.cut_at >= start,  # ty: ignore[unsupported-operator]
        CuttingOrder.cut_at < end,  # ty: ignore[unsupported-operator]
    )
    return int((await db.exec(stmt)).first() or 0)


async def _cutting_queue(
    db: AsyncSession, *, company_id: uuid.UUID, limit: int = OPERATOR_QUEUE_LIMIT
) -> list[OperatorCut]:
    """Cutting orders still in queue (company-wide), newest first."""

    stmt = (
        scoped(
            select(CuttingOrder.id, ProductSpec.code, CuttingOrder.color, CuttingOrder.status).join(
                ProductSpec, ProductSpec.id == CuttingOrder.spec_id
            ),
            CuttingOrder,
            company_id,
        )
        .where(CuttingOrder.status.in_((CuttingStatus.PENDING, CuttingStatus.CUTTING)))  # type: ignore[attr-defined]
        .order_by(CuttingOrder.created_at.desc())  # type: ignore[attr-defined]
        .limit(limit)
    )
    rows = (await db.exec(stmt)).all()
    # ``status`` is a StrEnum — str() yields the wire value ("pending"/"cutting")
    # whether the row returns the enum instance or a plain string.
    return [OperatorCut(id=row[0], code=row[1], color=row[2], status=str(row[3])) for row in rows]


async def _operator(db: AsyncSession, *, company_id: uuid.UUID) -> OperatorSummary:
    return OperatorSummary(
        cuts_in_queue=await _count_cutting_in_progress(db, company_id=company_id),
        shipments_incoming=await _count_sewing_active(db, company_id=company_id),
        pieces_today=await _pieces_cut_today(db, company_id=company_id),
        cutting_queue=await _cutting_queue(db, company_id=company_id),
    )


# --------------------------------------------------------------------------- public


async def get_summary(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    since: datetime | None = None,
) -> DashboardSummary:
    """Return the fully aggregated dashboard payload for ``company_id``.

    ``since`` scopes the order-book panorama (conference totals + top products)
    to orders with ``ordered_at >= since`` — the dashboard's date-range filter.
    ``None`` means all history. The operational lists (needs-action, activity,
    operator queue) are always current and ignore the window.
    """

    # Resolve the configured low-stock threshold once per request, plus any
    # per-variation overrides, and thread them into the needs-action list.
    company_threshold = await _company_threshold(db, company_id=company_id)
    threshold_overrides = await _variation_threshold_overrides(db, company_id=company_id)

    conference = await _conference(db, company_id=company_id, since=since)
    top_products = await _top_products(db, company_id=company_id, since=since)
    needs = await _needs_action(
        db,
        company_id=company_id,
        company_threshold=company_threshold,
        threshold_overrides=threshold_overrides,
    )
    activity = await _activity(db, company_id=company_id)
    operator = await _operator(db, company_id=company_id)

    return DashboardSummary(
        conference=conference,
        top_products=top_products,
        needs_action=needs,
        activity=activity,
        operator=operator,
    )


__all__ = ["get_summary"]
