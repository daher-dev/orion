"""Pydantic schemas for the Blank Pieces (peças lisas) feature.

A ``BlankPiece`` is a print-agnostic blank garment body keyed by
``(spec, size, color_code)``. On-hand is derived live from a single
append-only ledger (``blank_piece_movements``): ENTRY and ADJUSTMENT credit
stock, EXIT debits it. The service aggregates ledger rows into
``BlankPieceLevelRead`` per blank piece (every catalog row is surfaced, even
with zero movements); movement mutations are POST-only and surface as
``BlankMovementRead``.

Quantities are integer counts (not Decimal like the metered rolls). ``low_stock``
is computed per row from ``min_stock`` (when set) else the company-wide
``blank`` threshold; ``in_production`` is a typed placeholder (0) until the WIP
wiring lands in a later phase.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from models.enums import BlankMovementKind, Size
from schemas._common import Page

# ---------- Catalog create ----------


class BlankPieceCreate(BaseModel):
    spec_id: uuid.UUID
    size: Size
    color: str = Field(min_length=1, max_length=40)
    color_code: str = Field(pattern=r"^[A-Z]{3}$")
    min_stock: int | None = Field(default=None, ge=0)


# ---------- Nested DTOs ----------


class SpecMini(BaseModel):
    id: uuid.UUID
    code: str
    name: str


class BlankPieceMini(BaseModel):
    id: uuid.UUID
    spec_code: str
    size: Size
    color: str


# ---------- Blank piece x on-hand aggregate ----------


class BlankPieceLevelRead(BaseModel):
    """A single blank piece's aggregated on-hand position."""

    blank_piece_id: uuid.UUID
    spec_id: uuid.UUID
    spec: SpecMini
    size: Size
    color: str
    color_code: str
    min_stock: int | None = None
    on_hand: int
    in_production: int
    low_stock: bool
    entries_total: int
    exits_total: int
    last_movement_at: datetime | None = None


class BlankPieceLevelSummary(BaseModel):
    """Tenant-wide headline figures for the Peças Lisas page (all SKUs, not a page)."""

    total_on_hand: int
    below_min: int
    sku_count: int


# ---------- Ledger movements ----------


class BlankMovementCreate(BaseModel):
    blank_piece_id: uuid.UUID
    kind: BlankMovementKind = Field(default=BlankMovementKind.ENTRY)
    quantity: int = Field(gt=0)
    notes: str | None = Field(default=None, max_length=500)


class BlankMovementRead(BaseModel):
    id: uuid.UUID
    blank_piece_id: uuid.UUID
    blank_piece: BlankPieceMini | None = None
    kind: BlankMovementKind
    quantity: int
    notes: str | None
    created_at: datetime


# ---------- Filters ----------


class BlankPieceLevelFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    spec_id: uuid.UUID | None = None
    size: Size | None = None
    low_stock_only: bool = False


class BlankMovementFilters(BaseModel):
    blank_piece_id: uuid.UUID | None = None
    kind: BlankMovementKind | None = None
    date_from: date | None = None
    date_to: date | None = None


# ---------- Page aliases ----------


BlankPieceLevelPage = Page[BlankPieceLevelRead]
BlankMovementPage = Page[BlankMovementRead]
