"""Pydantic schemas for the Reports endpoints (FEATURE-015).

Four read-only reports, each exposed under ``GET /v1/reports/{slug}``:

- Sales: revenue by channel / status / day.
- Production: cutting + sewing throughput, scrap %.
- Inventory: current stock levels + slow-moving SKUs.
- Costs: per-spec unit cost + fabric cost per kg.

All numeric fields are wire-serialised as plain floats (FastAPI will JSON
encode them directly). Counts stay as ``int``.
"""

from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel

from models.enums import Ecommerce, FabricType, OrderStatus

# ----------- Sales report -----------


class SalesByChannel(BaseModel):
    channel: Ecommerce
    count: int
    revenue: float


class SalesByStatus(BaseModel):
    status: OrderStatus
    count: int


class SalesByDay(BaseModel):
    day: date
    count: int
    revenue: float


class SalesReport(BaseModel):
    by_channel: list[SalesByChannel]
    by_status: list[SalesByStatus]
    by_day: list[SalesByDay]
    total_count: int
    total_revenue: float


# ----------- Production report -----------


class CuttingThroughputPoint(BaseModel):
    day: date
    pieces_cut: int


class SewingThroughputPoint(BaseModel):
    day: date
    pieces_received: int


class ProductionReport(BaseModel):
    cutting_throughput: list[CuttingThroughputPoint]
    sewing_throughput: list[SewingThroughputPoint]
    scrap_pct: float


# ----------- Inventory report -----------


class InventoryLevel(BaseModel):
    variation_id: uuid.UUID
    sku: str
    on_hand: int


class SlowMover(BaseModel):
    variation_id: uuid.UUID
    sku: str
    days_no_movement: int


class InventoryReport(BaseModel):
    stock_levels: list[InventoryLevel]
    slow_movers: list[SlowMover]


# ----------- Costs report -----------


class SpecCostRow(BaseModel):
    spec_id: uuid.UUID
    spec_code: str
    labor_cost: float
    trim_cost: float
    total: float


class FabricCostRow(BaseModel):
    fabric_type: FabricType
    avg_cost: float


class CostsReport(BaseModel):
    spec_costs: list[SpecCostRow]
    fabric_cost_per_kg: list[FabricCostRow]


# ----------- Turnover / "giro" report -----------


class TurnoverRow(BaseModel):
    """Per-variation inventory turnover (giro) over the reporting window.

    ``turnover_ratio`` is ``units_sold / average_on_hand`` (0 when the average
    on-hand is <= 0). ``days_inventory_outstanding`` (DIO) is
    ``period_days / turnover_ratio`` and is ``None`` when turnover_ratio is 0
    (cannot divide by zero — there is no meaningful DIO without sales/stock).
    """

    variation_id: uuid.UUID
    sku: str
    spec_code: str
    units_sold: int
    average_on_hand: float
    turnover_ratio: float
    days_inventory_outstanding: float | None


class TurnoverReport(BaseModel):
    rows: list[TurnoverRow]
    period_days: int
    total_units_sold: int
    average_turnover_ratio: float


__all__ = [
    "CostsReport",
    "CuttingThroughputPoint",
    "FabricCostRow",
    "InventoryLevel",
    "InventoryReport",
    "ProductionReport",
    "SalesByChannel",
    "SalesByDay",
    "SalesByStatus",
    "SalesReport",
    "SewingThroughputPoint",
    "SlowMover",
    "SpecCostRow",
    "TurnoverReport",
    "TurnoverRow",
]
