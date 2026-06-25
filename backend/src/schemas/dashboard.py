"""Pydantic schemas for the Dashboard summary endpoint (FEATURE-015).

The dashboard is a read-only "panorama" centred on the daily *conferência*
(order checking). It aggregates over existing domain tables (orders, order
items, cutting orders, sewing shipments, audit log). No mutation schemas — the
only endpoint is ``GET /v1/dashboard/summary``.

The payload mirrors ``docs/design/pages/dashboard.jsx``: four conference KPIs,
the conference summary, a top-products ranking, the order report grid, the
operational follow-up lists, plus the operator (factory-floor) section.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


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


class TopProduct(BaseModel):
    """A design in the "Top 5 produtos" ranking (by pieces in the order book).

    Mirrors the legacy Base44 homepage: ``name`` is the mapped *estampa* (print
    design) name, falling back to the ad title for orders with no print.
    ``image_url`` is the design artwork (or a representative imported-order
    photo), ``None`` when neither exists — the frontend then renders a
    deterministic swatch seeded by ``name``. ``orders`` counts distinct
    marketplace orders; ``pieces`` sums quantities.
    """

    name: str
    image_url: str | None = None
    pieces: int
    orders: int


class ConferenceTotals(BaseModel):
    """Headline conference counters (the prototype's ``conference.totals``).

    Scope: ``orders``/``pieces`` count all orders with ``status != cancelled``;
    the item counters (``mapped``/``pending``/``pieces_checked``) are over the
    ``order_items`` of those same non-cancelled orders. The order-level
    ``orders_*`` classification buckets every non-cancelled order by how many of
    its items are checked (conferido).
    """

    orders: int
    pieces: int
    mapped: int  # order_items with variation_id NOT NULL
    pending: int  # order_items with variation_id NULL (await De/Para)
    mapped_pct: int  # round(100 * mapped / (mapped+pending)); 100 when denom 0
    in_lote: int  # orders with batch_id NOT NULL
    orders_checked: int  # orders with ALL items checked
    orders_partial: int  # orders with SOME (not all) items checked
    orders_untouched: int  # orders with ZERO items checked (or no items yet)
    pieces_checked: int  # order_items with status == checked (conferido)


class ConferenceSummary(BaseModel):
    """The Conferência section of the dashboard (orders→pieces pipeline)."""

    totals: ConferenceTotals


class OperatorCut(BaseModel):
    """A cutting order in the operator's queue (production-floor dashboard)."""

    id: uuid.UUID
    code: str  # ProductSpec.code of the garment base
    color: str  # free-text colorway
    status: str  # CuttingStatus value ("pending" | "cutting")


class OperatorSummary(BaseModel):
    """The operator (factory-floor) dashboard section.

    Honest mappings, noted because the data model has no per-operator
    assignment nor shipment ETA today:
    - ``cuts_in_queue`` — company-wide cutting orders still in queue.
    - ``shipments_incoming`` — sewing shipments still out at contractors.
    - ``pieces_today`` — pieces cut today (cutting outputs whose order's
      ``cut_at`` is today).
    """

    cuts_in_queue: int
    shipments_incoming: int
    pieces_today: int
    cutting_queue: list[OperatorCut]


class DashboardSummary(BaseModel):
    """Composite payload returned by ``GET /v1/dashboard/summary``."""

    conference: ConferenceSummary
    top_products: list[TopProduct]
    needs_action: list[NeedsActionItem]
    activity: list[ActivityItem]
    operator: OperatorSummary


__all__ = [
    "ActivityItem",
    "ConferenceSummary",
    "ConferenceTotals",
    "DashboardSummary",
    "NeedsActionItem",
    "OperatorCut",
    "OperatorSummary",
    "TopProduct",
]
