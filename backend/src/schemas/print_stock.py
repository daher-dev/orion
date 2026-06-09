"""Pydantic schemas for the Print Stock (estoque de estampas / impresso) feature.

On-hand is derived live from a single append-only ledger
(`print_stock_movements`): ENTRY and ADJUSTMENT credit, EXIT debits. The
service aggregates rows into `PrintStockLevelRead` per
`(print_design, product_color)`; mutations are POST-only and surface as
`PrintStockMovementRead`.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from models.enums import PrintStockDirection
from schemas._common import Page

# ---------- Nested DTOs ----------


class PrintDesignMini(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    image_url: str | None = None


class PrintStockBatchMini(BaseModel):
    id: uuid.UUID


# ---------- Design x colour x on-hand aggregate ----------


class PrintStockLevelRead(BaseModel):
    """A single (print_design, product_color) aggregated printed-stamp position."""

    print_design_id: uuid.UUID
    product_color: str
    design: PrintDesignMini
    on_hand: int
    entries_total: int
    exits_total: int
    last_movement_at: datetime | None = None


# ---------- Ledger movements ----------


class PrintStockEntryCreate(BaseModel):
    print_design_id: uuid.UUID
    product_color: str = Field(min_length=1, max_length=80)
    quantity: int = Field(gt=0)
    notes: str | None = Field(default=None, max_length=500)


class PrintStockExitCreate(BaseModel):
    print_design_id: uuid.UUID
    product_color: str = Field(min_length=1, max_length=80)
    quantity: int = Field(gt=0)
    notes: str | None = Field(default=None, max_length=500)


class PrintStockMovementRead(BaseModel):
    id: uuid.UUID
    print_design_id: uuid.UUID
    product_color: str
    design: PrintDesignMini | None = None
    direction: PrintStockDirection
    quantity: int
    notes: str | None
    created_at: datetime
    batch: PrintStockBatchMini | None = None


# ---------- Filters ----------


class PrintStockLevelFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    print_design_id: uuid.UUID | None = None
    product_color: str | None = Field(default=None, max_length=80)


class PrintStockMovementFilters(BaseModel):
    print_design_id: uuid.UUID | None = None
    product_color: str | None = Field(default=None, max_length=80)
    direction: PrintStockDirection | None = None
    date_from: date | None = None
    date_to: date | None = None


# ---------- Page aliases ----------


PrintStockLevelPage = Page[PrintStockLevelRead]
PrintStockMovementPage = Page[PrintStockMovementRead]
