"""Pydantic schemas for the Printed Transfers (estampados) feature.

Replaces the old ``print_stock`` schemas. A ``PrintedTransfer`` is keyed by
``(print_design, side)`` via a real FK (not the old free-text ``product_color``).
On-hand is derived live from a single append-only ledger
(``printed_transfer_movements``): ENTRY and ADJUSTMENT credit stock, EXIT debits
it. The service aggregates ledger rows into ``PrintedTransferLevelRead`` per
printed transfer (every catalog row is surfaced, even with zero movements);
movement mutations are POST-only and surface as ``PrintedMovementRead``.

Quantities are integer counts. ``low_stock`` is computed per row from the
row-level ``min_stock`` (when set) else the company-wide ``printed`` threshold;
``in_production`` is a typed placeholder (0) until the WIP wiring lands later.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from models.enums import PrintedMovementKind, PrintSide
from schemas._common import Page

# ---------- Catalog create ----------


class PrintedTransferCreate(BaseModel):
    print_design_id: uuid.UUID
    side: PrintSide
    min_stock: int | None = Field(default=None, ge=0)


# ---------- Nested DTOs ----------


class PrintDesignMini(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    image_url: str | None = None


# ---------- Printed transfer x on-hand aggregate ----------


class PrintedTransferLevelRead(BaseModel):
    """A single printed transfer's aggregated on-hand position."""

    printed_transfer_id: uuid.UUID
    print_design_id: uuid.UUID
    design: PrintDesignMini
    side: PrintSide
    min_stock: int | None = None
    on_hand: int
    in_production: int
    low_stock: bool
    entries_total: int
    exits_total: int
    last_movement_at: datetime | None = None


# ---------- Ledger movements ----------


class PrintedMovementCreate(BaseModel):
    printed_transfer_id: uuid.UUID
    kind: PrintedMovementKind = Field(default=PrintedMovementKind.ENTRY)
    quantity: int = Field(gt=0)
    notes: str | None = Field(default=None, max_length=500)


class PrintedMovementRead(BaseModel):
    id: uuid.UUID
    printed_transfer_id: uuid.UUID
    design: PrintDesignMini | None = None
    side: PrintSide
    kind: PrintedMovementKind
    quantity: int
    notes: str | None
    created_at: datetime


# ---------- Filters ----------


class PrintedTransferLevelFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    print_design_id: uuid.UUID | None = None
    side: PrintSide | None = None
    low_stock_only: bool = False


class PrintedMovementFilters(BaseModel):
    printed_transfer_id: uuid.UUID | None = None
    print_design_id: uuid.UUID | None = None
    side: PrintSide | None = None
    kind: PrintedMovementKind | None = None
    date_from: date | None = None
    date_to: date | None = None


# ---------- Page aliases ----------


PrintedTransferLevelPage = Page[PrintedTransferLevelRead]
PrintedMovementPage = Page[PrintedMovementRead]
