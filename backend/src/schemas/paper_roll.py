"""Pydantic schemas for the Paper Rolls (bobinas de papel/filme) feature.

Mirrors the Fabric (bobinas) feature: a ``PaperRoll`` carries an authoritative
``current_meters`` column (NOT a ledger sum) plus a ``paper_roll_movements``
ledger for traceable history. ``PaperRollRead`` adds a computed ``consumed_meters``
field and an ``on_hand`` alias (= ``current_meters``). Decimal columns are
serialized as strings (FastAPI / Pydantic default) — the frontend zod layer
mirrors that contract.

``low_stock`` is computed per row: a row-level ``min_stock`` (absolute meters
floor) overrides the company-wide ``paper`` threshold (default % of initial).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from models.enums import PaperMovementKind, PaperType
from schemas._common import Page

# ---------- Catalog CRUD ----------


class PaperRollCreate(BaseModel):
    received_at: date
    supplier_name: str = Field(min_length=1, max_length=120)
    paper_type: PaperType
    width_cm: int = Field(gt=0)
    initial_meters: Decimal = Field(gt=Decimal("0"), max_digits=10, decimal_places=2)
    min_stock: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=10, decimal_places=2)
    # Optional — defaults to `initial_meters` at insert when omitted.
    current_meters: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=10, decimal_places=2)


class PaperRollUpdate(BaseModel):
    received_at: date | None = None
    supplier_name: str | None = Field(default=None, min_length=1, max_length=120)
    paper_type: PaperType | None = None
    width_cm: int | None = Field(default=None, gt=0)
    initial_meters: Decimal | None = Field(default=None, gt=Decimal("0"), max_digits=10, decimal_places=2)
    current_meters: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=10, decimal_places=2)
    min_stock: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=10, decimal_places=2)


class PaperRollRead(BaseModel):
    id: uuid.UUID
    received_at: date
    supplier_name: str
    paper_type: PaperType
    width_cm: int
    initial_meters: Decimal
    current_meters: Decimal
    consumed_meters: Decimal
    min_stock: Decimal | None = None
    on_hand: Decimal
    low_stock: bool
    created_at: datetime
    updated_at: datetime


# ---------- Roll-level consume ----------


class PaperRollConsume(BaseModel):
    quantity: Decimal = Field(gt=Decimal("0"), max_digits=12, decimal_places=3)
    notes: str | None = Field(default=None, max_length=500)


# ---------- Ledger movements ----------


class PaperMovementCreate(BaseModel):
    paper_roll_id: uuid.UUID
    kind: PaperMovementKind = Field(default=PaperMovementKind.ENTRY)
    quantity: Decimal = Field(gt=Decimal("0"), max_digits=12, decimal_places=3)
    notes: str | None = Field(default=None, max_length=500)


class PaperRollMini(BaseModel):
    id: uuid.UUID
    paper_type: PaperType
    supplier_name: str


class PaperMovementRead(BaseModel):
    id: uuid.UUID
    paper_roll_id: uuid.UUID
    paper_roll: PaperRollMini | None = None
    kind: PaperMovementKind
    quantity: Decimal
    notes: str | None
    created_at: datetime


# ---------- Filters ----------


class PaperRollFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    paper_type: PaperType | None = None
    low_stock_only: bool = False


class PaperMovementFilters(BaseModel):
    paper_roll_id: uuid.UUID | None = None
    kind: PaperMovementKind | None = None
    date_from: date | None = None
    date_to: date | None = None


# ---------- Page aliases ----------


PaperRollPage = Page[PaperRollRead]
PaperMovementPage = Page[PaperMovementRead]
