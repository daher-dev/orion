"""Pydantic schemas for the Dashboard summary endpoint (FEATURE-015).

The dashboard is a read-only "panorama" that aggregates over existing
domain tables (orders, cutting orders, sewing shipments, stock movements,
audit log). No mutation schemas — the only endpoint is
``GET /v1/dashboard/summary``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class Kpi(BaseModel):
    """A single KPI card: label + value + optional delta + optional sparkline."""

    label: str
    value: float
    delta_pct: float | None = None
    sparkline: list[int] | None = None


class DashboardKpis(BaseModel):
    """All five KPI cards rendered on the dashboard strip."""

    orders_pending: Kpi
    orders_revenue_30d: Kpi
    cutting_pending: Kpi
    stock_low: Kpi
    banca_active: Kpi


class PipelineCounts(BaseModel):
    """Five-stage production pipeline counters.

    - ``total_pending_orders`` — orders with status=pending.
    - ``in_cutting`` — cutting orders with status in {pending, cutting}.
    - ``in_sewing`` — sewing shipments with status in {sent, partial}.
    - ``in_stock`` — variations with on-hand > 0 (only those with any
      ledger history are counted).
    - ``shipped_30d`` — orders that transitioned to shipped in the last
      30 days (approximated via orders.updated_at since we don't keep a
      transition history table).
    """

    total_pending_orders: int
    in_cutting: int
    in_sewing: int
    in_stock: int
    shipped_30d: int


class NeedsActionItem(BaseModel):
    """A single line in the "needs action" list on the dashboard.

    ``kind`` is a stable identifier the frontend uses to pick the right
    icon + sub-product color (e.g. "orders_pending", "stock_low").
    """

    kind: str
    message: str
    link: str


class ActivityItem(BaseModel):
    """A single line in the activity feed (newest first).

    Mirrors the audit-log row shape used in F-018 but kept narrower so the
    feed payload stays tiny.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    when: datetime
    who: str | None
    message: str
    resource_type: str
    resource_id: uuid.UUID


class ChannelRevenue(BaseModel):
    """Revenue figure for a single ecommerce channel."""

    channel: str
    revenue: float


class ConferenceTotals(BaseModel):
    """Headline conference counters (the prototype's ``conference.totals``).

    Scope: ``orders``/``pieces`` count all orders with ``status != cancelled``;
    the item counters are over ``order_items``.
    """

    orders: int
    pieces: int
    mapped: int  # order_items with variation_id NOT NULL
    pending: int  # order_items with variation_id NULL (await De/Para)
    checked: int  # order_items status == checked (conferido)
    to_check: int  # order_items status == label_printed (printed, not scanned)
    in_lote: int  # orders with batch_id NOT NULL
    mapped_pct: int  # round(100 * mapped / (mapped+pending)); 100 when denom 0


class ConferencePipeline(BaseModel):
    """Order-pipeline counts (distinct from the production ``PipelineCounts``).

    Mirrors the board's four columns, derived from the readiness flags:
    - ``mapeamento`` — orders with ≥1 unmapped piece.
    - ``producao`` — mapped, unbatched, NOT ready.
    - ``separacao`` — mapped, unbatched, ready.
    - ``envio`` — orders with a batch.
    """

    mapeamento: int
    producao: int
    separacao: int
    envio: int


class ConferenceBatchCounts(BaseModel):
    """Batch lifecycle counts for the conference strip."""

    open: int
    in_production: int
    dispatched: int


class ConferenceSummary(BaseModel):
    """The Conferência section of the dashboard (orders→pieces pipeline)."""

    totals: ConferenceTotals
    pipeline: ConferencePipeline
    batches: ConferenceBatchCounts


class DashboardSummary(BaseModel):
    """Composite payload returned by ``GET /v1/dashboard/summary``."""

    kpis: DashboardKpis
    pipeline: PipelineCounts
    needs_action: list[NeedsActionItem]
    activity: list[ActivityItem]
    revenue_by_channel: list[ChannelRevenue]
    conference: ConferenceSummary


__all__ = [
    "ActivityItem",
    "ChannelRevenue",
    "ConferenceBatchCounts",
    "ConferencePipeline",
    "ConferenceSummary",
    "ConferenceTotals",
    "DashboardKpis",
    "DashboardSummary",
    "Kpi",
    "NeedsActionItem",
    "PipelineCounts",
]
