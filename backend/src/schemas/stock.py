"""Pydantic schemas for the Stock (estoque) feature.

The on-hand balance is derived from two append-only ledgers — `stock_entries`
and `stock_exits`. The service aggregates those into `VariationStockRead`
rows; mutations are POST-only (no PATCH/DELETE) and surface as either
`StockEntryRead` or `StockExitRead` shapes.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from models.enums import Size, StockExitReason, StockSource
from schemas._common import Page

# ---------- Nested DTOs ----------


class StockProductMini(BaseModel):
    id: uuid.UUID
    name: str
    code: str


class StockShipmentMini(BaseModel):
    id: uuid.UUID


class StockOrderMini(BaseModel):
    id: uuid.UUID


# ---------- Variation x on-hand aggregate ----------


class VariationStockRead(BaseModel):
    """A single product variation's aggregated stock position."""

    variation_id: uuid.UUID
    sku: str
    size: Size
    color: str
    color_code: str
    product: StockProductMini
    on_hand: int
    entries_total: int
    exits_total: int
    last_movement_at: datetime | None = None


# ---------- Ledger entries ----------


class StockEntryCreate(BaseModel):
    variation_id: uuid.UUID
    quantity: int = Field(gt=0)
    source: StockSource = Field(default=StockSource.ADJUSTMENT)
    notes: str | None = Field(default=None, max_length=500)


class StockEntryRead(BaseModel):
    id: uuid.UUID
    variation_id: uuid.UUID
    sku: str
    source: StockSource
    quantity: int
    notes: str | None
    created_at: datetime
    shipment: StockShipmentMini | None = None


# ---------- Ledger exits ----------


class StockExitCreate(BaseModel):
    variation_id: uuid.UUID
    quantity: int = Field(gt=0)
    reason: StockExitReason = Field(default=StockExitReason.ADJUSTMENT)
    notes: str | None = Field(default=None, max_length=500)


class StockExitRead(BaseModel):
    id: uuid.UUID
    variation_id: uuid.UUID
    sku: str
    reason: StockExitReason
    quantity: int
    notes: str | None
    created_at: datetime
    order: StockOrderMini | None = None


# ---------- Union ledger view ----------


class StockMovementEntry(StockEntryRead):
    """An `entry` row in the interleaved ledger."""

    type: Literal["entry"] = "entry"


class StockMovementExit(StockExitRead):
    """An `exit` row in the interleaved ledger."""

    type: Literal["exit"] = "exit"


StockMovementRead = StockMovementEntry | StockMovementExit


# ---------- Filters ----------


class StockFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    product_id: uuid.UUID | None = None
    low_stock_only: bool = False
    threshold: int = Field(default=5, ge=0)


class MovementsFilters(BaseModel):
    variation_id: uuid.UUID | None = None
    date_from: date | None = None
    date_to: date | None = None
    type: Literal["entry", "exit"] | None = None
    reason_or_source: str | None = Field(default=None, max_length=40)


# ---------- Page aliases ----------


StockPage = Page[VariationStockRead]
EntryPage = Page[StockEntryRead]
ExitPage = Page[StockExitRead]
MovementsPage = Page[StockMovementRead]
