"""Service layer for the Dashboard summary (FEATURE-015).

Read-only — every query aggregates over existing tenant-scoped tables.
The single public entry point is :func:`get_summary`, which returns a
fully populated :class:`DashboardSummary` ready to be sent on the wire.

Aggregation conventions
-----------------------
- All ``SELECT`` calls are tenant-scoped through ``scoped()``.
- We avoid an N+1 by computing the activity feed via a single joined
  ``select(AuditLog, User)`` (same pattern as the audit-log viewer).
- Sparkline data: 7-day buckets going back from "today". Empty buckets
  return 0 — the frontend draws those as a flat baseline.
- Threshold for "stock_low": variations with on-hand ≤ ``LOW_STOCK_THRESHOLD``
  AND at least one historical movement (we don't want to surface "empty
  ledger" SKUs as low).
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    Ad,
    AuditLog,
    CuttingOrder,
    CuttingStatus,
    FabricRoll,
    Order,
    OrderStatus,
    SewingShipment,
    ShipmentStatus,
    StockEntry,
    StockExit,
    User,
)
from schemas.dashboard import (
    ActivityItem,
    ChannelRevenue,
    DashboardKpis,
    DashboardSummary,
    Kpi,
    NeedsActionItem,
    PipelineCounts,
)
from services._base import scoped

#: Stock threshold used to decide whether a SKU is "low".
LOW_STOCK_THRESHOLD = 10

#: Days for the revenue window + the comparison delta.
REVENUE_WINDOW_DAYS = 30

#: How many days back the sparkline covers.
SPARK_DAYS = 7

#: Maximum number of audit rows surfaced in the activity feed.
ACTIVITY_LIMIT = 20

#: How many top items to surface in the needs-action list.
NEEDS_ACTION_LIMIT = 5


# --------------------------------------------------------------------------- utilities


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _start_of_window(days: int) -> datetime:
    """Return midnight UTC for ``days`` ago — keeps the day-buckets stable."""
    today = _utc_now().date()
    return datetime.combine(today - timedelta(days=days), datetime.min.time(), tzinfo=UTC)


# --------------------------------------------------------------------------- KPI helpers


async def _count_orders_with_status(db: AsyncSession, *, company_id: uuid.UUID, status: OrderStatus) -> int:
    stmt = scoped(
        select(func.count()).select_from(Order),
        Order,
        company_id,
    ).where(Order.status == status)
    return int((await db.exec(stmt)).first() or 0)


async def _sum_revenue_since(
    db: AsyncSession, *, company_id: uuid.UUID, since: datetime, until: datetime | None = None
) -> Decimal:
    stmt = scoped(
        select(func.coalesce(func.sum(Order.sale_price * Order.quantity), 0)),
        Order,
        company_id,
    ).where(Order.ordered_at >= since)
    if until is not None:
        stmt = stmt.where(Order.ordered_at < until)
    raw = (await db.exec(stmt)).first() or 0
    # SQLAlchemy may return Decimal | int | float depending on the dialect.
    return Decimal(str(raw))


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


def _count_low_stock(levels: dict[uuid.UUID, int]) -> int:
    return sum(1 for value in levels.values() if value <= LOW_STOCK_THRESHOLD)


def _count_in_stock(levels: dict[uuid.UUID, int]) -> int:
    return sum(1 for value in levels.values() if value > 0)


# --------------------------------------------------------------------------- pipeline


async def _shipped_in_last(db: AsyncSession, *, company_id: uuid.UUID, days: int) -> int:
    bound = _utc_now() - timedelta(days=days)
    stmt = scoped(
        select(func.count()).select_from(Order),
        Order,
        company_id,
    ).where(
        Order.status == OrderStatus.SHIPPED,
        Order.updated_at >= bound,  # type: ignore[attr-defined]
    )
    return int((await db.exec(stmt)).first() or 0)


# --------------------------------------------------------------------------- sparkline


async def _orders_revenue_sparkline(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    days: int = SPARK_DAYS,
) -> list[int]:
    """7-day daily revenue series ending today (rounded to the nearest BRL)."""

    # asyncpg requires the GROUP BY expression to be the *same* expression
    # tree as the SELECT one — repeating the date_trunc() call produces
    # different SQL nodes. Bind it to a name and reuse.
    day_expr = func.date_trunc("day", Order.ordered_at)
    rows = await db.exec(
        scoped(
            select(
                day_expr.label("day"),
                func.coalesce(func.sum(Order.sale_price * Order.quantity), 0).label("revenue"),
            ),
            Order,
            company_id,
        )
        .where(Order.ordered_at >= _start_of_window(days - 1))
        .group_by(day_expr)
    )
    by_day: dict[date, int] = {}
    for day, revenue in rows.all():
        # ``day`` is a datetime at midnight UTC — collapse to a date.
        actual_day = day.date() if isinstance(day, datetime) else day
        by_day[actual_day] = int(Decimal(str(revenue or 0)))
    today = _utc_now().date()
    return [by_day.get(today - timedelta(days=i), 0) for i in reversed(range(days))]


async def _created_per_day_sparkline(
    db: AsyncSession,
    *,
    model: type,
    company_id: uuid.UUID,
    days: int = SPARK_DAYS,
) -> list[int]:
    """Generic daily-creation sparkline for any CompanyModel."""
    day_expr = func.date_trunc("day", model.created_at)
    rows = await db.exec(
        scoped(
            select(
                day_expr.label("day"),
                func.count().label("cnt"),
            ),
            model,
            company_id,
        )
        .where(model.created_at >= _start_of_window(days - 1))
        .group_by(day_expr)
    )
    by_day: dict[date, int] = {}
    for day, cnt in rows.all():
        actual_day = day.date() if isinstance(day, datetime) else day
        by_day[actual_day] = int(cnt or 0)
    today = _utc_now().date()
    return [by_day.get(today - timedelta(days=i), 0) for i in reversed(range(days))]


async def _count_created_in_range(
    db: AsyncSession,
    *,
    model: type,
    company_id: uuid.UUID,
    since: datetime,
    until: datetime | None = None,
) -> int:
    stmt = scoped(
        select(func.count()).select_from(model),
        model,
        company_id,
    ).where(model.created_at >= since)
    if until is not None:
        stmt = stmt.where(model.created_at < until)
    return int((await db.exec(stmt)).first() or 0)


# --------------------------------------------------------------------------- needs action


async def _needs_action(db: AsyncSession, *, company_id: uuid.UUID) -> list[NeedsActionItem]:
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
    low = _count_low_stock(levels)
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


# --------------------------------------------------------------------------- revenue by channel


async def _revenue_by_channel(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    days: int = REVENUE_WINDOW_DAYS,
) -> list[ChannelRevenue]:
    """Revenue grouped by ecommerce channel for the last ``days`` days."""
    since = _start_of_window(days)
    stmt = (
        scoped(
            select(
                Ad.ecommerce.label("channel"),
                func.coalesce(func.sum(Order.sale_price * Order.quantity), 0).label("revenue"),
            ).join(Ad, Order.ad_id == Ad.id),
            Order,
            company_id,
        )
        .where(Order.ordered_at >= since)
        .group_by(Ad.ecommerce)
        .order_by(func.sum(Order.sale_price * Order.quantity).desc())
    )
    rows = (await db.exec(stmt)).all()
    return [ChannelRevenue(channel=str(row.channel), revenue=float(row.revenue)) for row in rows]


# --------------------------------------------------------------------------- public


def _delta_pct(current: float, previous: float) -> float | None:
    """Symmetric delta in percent. Returns ``None`` if previous is zero so
    the frontend can hide the chip rather than printing ``inf``.
    """

    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 1)


async def get_summary(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
) -> DashboardSummary:
    """Return the fully aggregated dashboard payload for ``company_id``."""

    # ----- KPIs -----
    orders_pending = await _count_orders_with_status(db, company_id=company_id, status=OrderStatus.PENDING)

    now = _utc_now()
    revenue_since = now - timedelta(days=REVENUE_WINDOW_DAYS)
    previous_since = now - timedelta(days=REVENUE_WINDOW_DAYS * 2)
    revenue_30d = await _sum_revenue_since(db, company_id=company_id, since=revenue_since)
    revenue_prev = await _sum_revenue_since(
        db,
        company_id=company_id,
        since=previous_since,
        until=revenue_since,
    )
    revenue_30d_value = float(revenue_30d)
    revenue_delta = _delta_pct(revenue_30d_value, float(revenue_prev))

    cutting_pending = await _count_cutting_in_progress(db, company_id=company_id)
    banca_active = await _count_sewing_active(db, company_id=company_id)

    levels = await _on_hand_per_variation(db, company_id=company_id)
    stock_low = _count_low_stock(levels)
    in_stock = _count_in_stock(levels)

    revenue_sparkline = await _orders_revenue_sparkline(db, company_id=company_id)

    # Sparklines — daily creation count over last 7 days.
    orders_spark = await _created_per_day_sparkline(db, model=Order, company_id=company_id)
    cutting_spark = await _created_per_day_sparkline(db, model=CuttingOrder, company_id=company_id)
    sewing_spark = await _created_per_day_sparkline(db, model=SewingShipment, company_id=company_id)

    # Deltas — count of entities created in last 30d vs previous 30d.
    orders_30d = await _count_created_in_range(db, model=Order, company_id=company_id, since=revenue_since)
    orders_prev = await _count_created_in_range(
        db, model=Order, company_id=company_id, since=previous_since, until=revenue_since
    )
    orders_pending_delta = _delta_pct(float(orders_30d), float(orders_prev))

    cutting_30d = await _count_created_in_range(db, model=CuttingOrder, company_id=company_id, since=revenue_since)
    cutting_prev = await _count_created_in_range(
        db, model=CuttingOrder, company_id=company_id, since=previous_since, until=revenue_since
    )
    cutting_delta = _delta_pct(float(cutting_30d), float(cutting_prev))

    sewing_30d = await _count_created_in_range(db, model=SewingShipment, company_id=company_id, since=revenue_since)
    sewing_prev = await _count_created_in_range(
        db, model=SewingShipment, company_id=company_id, since=previous_since, until=revenue_since
    )
    sewing_delta = _delta_pct(float(sewing_30d), float(sewing_prev))

    kpis = DashboardKpis(
        orders_pending=Kpi(
            label="orders_pending",
            value=float(orders_pending),
            delta_pct=orders_pending_delta,
            sparkline=orders_spark,
        ),
        orders_revenue_30d=Kpi(
            label="orders_revenue_30d",
            value=revenue_30d_value,
            delta_pct=revenue_delta,
            sparkline=revenue_sparkline,
        ),
        cutting_pending=Kpi(
            label="cutting_pending",
            value=float(cutting_pending),
            delta_pct=cutting_delta,
            sparkline=cutting_spark,
        ),
        stock_low=Kpi(label="stock_low", value=float(stock_low)),
        banca_active=Kpi(
            label="banca_active",
            value=float(banca_active),
            delta_pct=sewing_delta,
            sparkline=sewing_spark,
        ),
    )

    # ----- Pipeline -----
    shipped_30d = await _shipped_in_last(db, company_id=company_id, days=30)
    pipeline = PipelineCounts(
        total_pending_orders=orders_pending,
        in_cutting=cutting_pending,
        in_sewing=banca_active,
        in_stock=in_stock,
        shipped_30d=shipped_30d,
    )

    # ----- Lists -----
    needs = await _needs_action(db, company_id=company_id)
    activity = await _activity(db, company_id=company_id)
    revenue_by_channel = await _revenue_by_channel(db, company_id=company_id)

    return DashboardSummary(
        kpis=kpis,
        pipeline=pipeline,
        needs_action=needs,
        activity=activity,
        revenue_by_channel=revenue_by_channel,
    )


__all__ = ["get_summary"]
