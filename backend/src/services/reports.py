"""Service layer for the Reports endpoints (FEATURE-015).

Four read-only aggregators (one per tab on the frontend). All are
tenant-scoped and accept an optional ``date_from``/``date_to`` window.

Sales / Production
------------------
The Sales and Production reports honour the date range. When the caller
omits the range we default to "the last 30 days".

Inventory / Costs
-----------------
Inventory and Costs are inherently "current state" reports, so the date
range is unused. We keep the parameter signature consistent (the router
accepts ``date_from``/``date_to``) but the service ignores those values.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    Ad,
    CuttingOrder,
    CuttingOrderOutput,
    FabricRoll,
    Order,
    ProductSpec,
    ProductVariation,
    SewingShipment,
    SewingShipmentItem,
    ShipmentStatus,
    SpecTrim,
    StockEntry,
    StockExit,
)
from schemas.reports import (
    CostsReport,
    CuttingThroughputPoint,
    FabricCostRow,
    InventoryLevel,
    InventoryReport,
    ProductionReport,
    SalesByChannel,
    SalesByDay,
    SalesByStatus,
    SalesReport,
    SewingThroughputPoint,
    SlowMover,
    SpecCostRow,
)
from services._base import scoped

#: Default reporting window in days when the caller omits the date range.
DEFAULT_WINDOW_DAYS = 30

#: Cap for "stock_levels" rows surfaced in the inventory report.
STOCK_LEVELS_LIMIT = 25

#: Cap for "slow_movers" rows.
SLOW_MOVERS_LIMIT = 10

#: Minimum days since last movement to count as a "slow mover".
SLOW_MOVER_THRESHOLD_DAYS = 30


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _resolve_range(
    date_from: datetime | None,
    date_to: datetime | None,
) -> tuple[datetime, datetime]:
    """Default to a closed 30-day window ending now when bounds are omitted."""

    now = _utc_now()
    upper = date_to or now
    lower = date_from or (upper - timedelta(days=DEFAULT_WINDOW_DAYS))
    return lower, upper


# --------------------------------------------------------------------------- sales


async def sales_report(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> SalesReport:
    """Aggregate orders into the four projections rendered by the Sales tab.

    Buckets cancelled / returned alongside successful orders intentionally —
    the operator wants to see "how many orders by status" without us
    silently dropping the bad ones.
    """

    lower, upper = _resolve_range(date_from, date_to)

    # by channel — join through the ad to get the ecommerce enum.
    by_channel_stmt = (
        scoped(
            select(
                Ad.ecommerce,
                func.count(Order.id).label("count"),
                func.coalesce(func.sum(Order.sale_price * Order.quantity), 0).label("revenue"),
            ),
            Order,
            company_id,
        )
        .join(Ad, Ad.id == Order.ad_id)
        .where(Order.ordered_at >= lower, Order.ordered_at <= upper)
        .group_by(Ad.ecommerce)
        .order_by(func.count(Order.id).desc())
    )
    by_channel = [
        SalesByChannel(
            channel=channel,
            count=int(count or 0),
            revenue=float(Decimal(str(revenue or 0))),
        )
        for channel, count, revenue in (await db.exec(by_channel_stmt)).all()
    ]

    # by status
    by_status_stmt = (
        scoped(
            select(Order.status, func.count(Order.id).label("count")),
            Order,
            company_id,
        )
        .where(Order.ordered_at >= lower, Order.ordered_at <= upper)
        .group_by(Order.status)
        .order_by(Order.status)
    )
    by_status = [
        SalesByStatus(status=status, count=int(count or 0))
        for status, count in (await db.exec(by_status_stmt)).all()
    ]

    # by day — bind the date_trunc expression once so GROUP BY / ORDER BY
    # share the same SQL node with the SELECT (asyncpg is strict).
    sales_day_expr = func.date_trunc("day", Order.ordered_at)
    by_day_stmt = (
        scoped(
            select(
                sales_day_expr.label("day"),
                func.count(Order.id).label("count"),
                func.coalesce(func.sum(Order.sale_price * Order.quantity), 0).label("revenue"),
            ),
            Order,
            company_id,
        )
        .where(Order.ordered_at >= lower, Order.ordered_at <= upper)
        .group_by(sales_day_expr)
        .order_by(sales_day_expr)
    )
    by_day = [
        SalesByDay(
            day=day.date() if isinstance(day, datetime) else day,
            count=int(count or 0),
            revenue=float(Decimal(str(revenue or 0))),
        )
        for day, count, revenue in (await db.exec(by_day_stmt)).all()
    ]

    total_count = sum(row.count for row in by_channel)
    total_revenue = sum(row.revenue for row in by_channel)
    return SalesReport(
        by_channel=by_channel,
        by_status=by_status,
        by_day=by_day,
        total_count=total_count,
        total_revenue=total_revenue,
    )


# --------------------------------------------------------------------------- production


async def production_report(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> ProductionReport:
    """Daily throughput for cutting + sewing plus a scrap percentage.

    Cutting throughput: sum of pieces in :class:`CuttingOrderOutput`,
    bucketed by the parent cutting order's ``cut_at`` timestamp.

    Sewing throughput: sum of ``received_quantity`` in
    :class:`SewingShipmentItem`, bucketed by the shipment's ``received_at``
    date. ``received_at`` can be ``None`` for shipments still in transit —
    those rows fall out of the date filter naturally.

    Scrap %: 100 * (1 - received / requested) on shipments whose status is
    ``received`` or ``partial``. Returns ``0.0`` when there are no rows.
    """

    lower, upper = _resolve_range(date_from, date_to)

    cut_day_expr = func.date_trunc("day", CuttingOrder.cut_at)
    cutting_stmt = (
        scoped(
            select(
                cut_day_expr.label("day"),
                func.coalesce(func.sum(CuttingOrderOutput.quantity), 0).label("pieces"),
            ),
            CuttingOrder,
            company_id,
        )
        .join(CuttingOrderOutput, CuttingOrderOutput.cutting_order_id == CuttingOrder.id)
        .where(
            CuttingOrder.cut_at.is_not(None),  # type: ignore[attr-defined]
            CuttingOrder.cut_at >= lower,
            CuttingOrder.cut_at <= upper,
        )
        .group_by(cut_day_expr)
        .order_by(cut_day_expr)
    )
    cutting_throughput = [
        CuttingThroughputPoint(
            day=day.date() if isinstance(day, datetime) else day,
            pieces_cut=int(pieces or 0),
        )
        for day, pieces in (await db.exec(cutting_stmt)).all()
    ]

    sewing_stmt = (
        scoped(
            select(
                SewingShipment.received_at.label("day"),  # type: ignore[attr-defined]
                func.coalesce(func.sum(SewingShipmentItem.received_quantity), 0).label("pieces"),
            ),
            SewingShipment,
            company_id,
        )
        .join(SewingShipmentItem, SewingShipmentItem.shipment_id == SewingShipment.id)
        .where(
            SewingShipment.received_at.is_not(None),  # type: ignore[attr-defined]
            SewingShipment.received_at >= lower.date(),
            SewingShipment.received_at <= upper.date(),
        )
        .group_by(SewingShipment.received_at)
        .order_by(SewingShipment.received_at)
    )
    sewing_throughput = [
        SewingThroughputPoint(day=day, pieces_received=int(pieces or 0))
        for day, pieces in (await db.exec(sewing_stmt)).all()
    ]

    # Scrap %: aggregate across received/partial shipments.
    scrap_stmt = (
        scoped(
            select(
                func.coalesce(func.sum(SewingShipmentItem.requested_quantity), 0).label("req"),
                func.coalesce(func.sum(SewingShipmentItem.received_quantity), 0).label("rec"),
            ),
            SewingShipment,
            company_id,
        )
        .join(SewingShipmentItem, SewingShipmentItem.shipment_id == SewingShipment.id)
        .where(
            SewingShipment.status.in_(  # type: ignore[attr-defined]
                (ShipmentStatus.RECEIVED, ShipmentStatus.PARTIAL)
            )
        )
    )
    requested_total, received_total = (await db.exec(scrap_stmt)).first() or (0, 0)
    requested_total = int(requested_total or 0)
    received_total = int(received_total or 0)
    scrap_pct = (
        round(100.0 * (1.0 - received_total / requested_total), 2)
        if requested_total > 0
        else 0.0
    )

    return ProductionReport(
        cutting_throughput=cutting_throughput,
        sewing_throughput=sewing_throughput,
        scrap_pct=scrap_pct,
    )


# --------------------------------------------------------------------------- inventory


async def inventory_report(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> InventoryReport:
    """Current stock levels (top N) plus the slow-mover list.

    ``date_from`` / ``date_to`` are accepted to keep router signatures
    uniform — they are ignored here because inventory is a snapshot.
    """

    _ = (date_from, date_to)  # explicitly unused

    entries_agg = (
        scoped(
            select(
                StockEntry.variation_id.label("variation_id"),
                func.coalesce(func.sum(StockEntry.quantity), 0).label("total"),
                func.max(StockEntry.created_at).label("last_at"),
            ),
            StockEntry,
            company_id,
        )
        .group_by(StockEntry.variation_id)
        .subquery()
    )
    exits_agg = (
        scoped(
            select(
                StockExit.variation_id.label("variation_id"),
                func.coalesce(func.sum(StockExit.quantity), 0).label("total"),
                func.max(StockExit.created_at).label("last_at"),
            ),
            StockExit,
            company_id,
        )
        .group_by(StockExit.variation_id)
        .subquery()
    )
    on_hand_expr = (
        func.coalesce(entries_agg.c.total, 0) - func.coalesce(exits_agg.c.total, 0)
    )
    last_move_expr = func.greatest(
        func.coalesce(entries_agg.c.last_at, exits_agg.c.last_at),
        func.coalesce(exits_agg.c.last_at, entries_agg.c.last_at),
    )

    levels_stmt = (
        select(
            ProductVariation.id,
            ProductVariation.sku,
            on_hand_expr.label("on_hand"),
            last_move_expr.label("last_at"),
        )
        .outerjoin(entries_agg, entries_agg.c.variation_id == ProductVariation.id)
        .outerjoin(exits_agg, exits_agg.c.variation_id == ProductVariation.id)
        .where(ProductVariation.company_id == company_id)
        .order_by(on_hand_expr.desc())
        .limit(STOCK_LEVELS_LIMIT)
    )
    levels: list[InventoryLevel] = []
    slow: list[SlowMover] = []
    now = _utc_now()
    threshold = now - timedelta(days=SLOW_MOVER_THRESHOLD_DAYS)

    # Re-run once for slow movers (the ORDER BY differs).
    slow_stmt = (
        select(
            ProductVariation.id,
            ProductVariation.sku,
            last_move_expr.label("last_at"),
        )
        .outerjoin(entries_agg, entries_agg.c.variation_id == ProductVariation.id)
        .outerjoin(exits_agg, exits_agg.c.variation_id == ProductVariation.id)
        .where(
            ProductVariation.company_id == company_id,
            last_move_expr.is_not(None),
            last_move_expr <= threshold,
        )
        .order_by(last_move_expr.asc())
        .limit(SLOW_MOVERS_LIMIT)
    )
    for variation_id, sku, on_hand, _last in (await db.exec(levels_stmt)).all():
        if on_hand is None:
            continue
        levels.append(
            InventoryLevel(
                variation_id=variation_id,
                sku=sku,
                on_hand=int(on_hand or 0),
            )
        )
    for variation_id, sku, last_at in (await db.exec(slow_stmt)).all():
        if last_at is None:
            continue
        last_dt = last_at if isinstance(last_at, datetime) else datetime.combine(last_at, datetime.min.time())
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=UTC)
        days = (now - last_dt).days
        slow.append(SlowMover(variation_id=variation_id, sku=sku, days_no_movement=days))

    return InventoryReport(stock_levels=levels, slow_movers=slow)


# --------------------------------------------------------------------------- costs


async def costs_report(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> CostsReport:
    """Unit cost per spec + average fabric price per fabric type.

    Spec costs combine the labor + the sum of the spec's trim costs. The
    fabric cost is intentionally kept separate (per fabric type) because
    a spec doesn't carry a fabric SKU — a spec defines the fabric *type*
    and the per-piece weight, so cost-per-piece depends on which roll the
    operator chooses to cut from.
    """

    _ = (date_from, date_to)  # explicitly unused

    trim_agg = (
        scoped(
            select(
                SpecTrim.spec_id.label("spec_id"),
                func.coalesce(
                    func.sum(SpecTrim.unit_price * SpecTrim.quantity), 0
                ).label("trim_total"),
            ),
            ProductSpec,
            company_id,
        )
        .join(ProductSpec, ProductSpec.id == SpecTrim.spec_id)
        .group_by(SpecTrim.spec_id)
        .subquery()
    )

    spec_stmt = (
        select(
            ProductSpec.id,
            ProductSpec.code,
            ProductSpec.labor_cost,
            func.coalesce(trim_agg.c.trim_total, 0).label("trim_total"),
        )
        .outerjoin(trim_agg, trim_agg.c.spec_id == ProductSpec.id)
        .where(ProductSpec.company_id == company_id)
        .order_by(ProductSpec.code)
    )
    spec_costs: list[SpecCostRow] = []
    for spec_id, code, labor_cost, trim_total in (await db.exec(spec_stmt)).all():
        labor = float(Decimal(str(labor_cost or 0)))
        trims = float(Decimal(str(trim_total or 0)))
        spec_costs.append(
            SpecCostRow(
                spec_id=spec_id,
                spec_code=code,
                labor_cost=labor,
                trim_cost=trims,
                total=round(labor + trims, 2),
            )
        )

    fabric_stmt = (
        scoped(
            select(
                FabricRoll.fabric_type,
                func.avg(FabricRoll.price_per_kg).label("avg_cost"),
            ),
            FabricRoll,
            company_id,
        )
        .group_by(FabricRoll.fabric_type)
        .order_by(FabricRoll.fabric_type)
    )
    fabric_rows = [
        FabricCostRow(
            fabric_type=fabric_type,
            avg_cost=round(float(Decimal(str(avg_cost or 0))), 2),
        )
        for fabric_type, avg_cost in (await db.exec(fabric_stmt)).all()
    ]

    return CostsReport(spec_costs=spec_costs, fabric_cost_per_kg=fabric_rows)


# Re-exports for tests + symmetric router import surface.
__all__ = [
    "costs_report",
    "inventory_report",
    "production_report",
    "sales_report",
]
