"""Pydantic schemas for the Consumables / supply inventory (insumos) feature.

A ``Supply`` is a CRUD catalog entry (name / unit / unit cost / optional
reorder threshold). On-hand is derived live from a single append-only ledger
(``supply_movements``): ENTRY and ADJUSTMENT credit stock, EXIT debits it. The
service aggregates ledger rows into ``SupplyLevelRead`` per supply; movement
mutations are POST-only and surface as ``SupplyMovementRead``.

Decimal columns (``unit_cost``, ``min_stock``, ``quantity``, on-hand totals)
are serialized as strings on the wire — the frontend zod layer mirrors that.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from models.enums import SupplyMovementKind
from schemas._common import Page

# ---------- Catalog CRUD ----------


class SupplyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    unit: str = Field(min_length=1, max_length=20)
    unit_cost: Decimal = Field(ge=Decimal("0"), max_digits=10, decimal_places=2)
    min_stock: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=12, decimal_places=3)
    notes: str | None = Field(default=None, max_length=500)


class SupplyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    unit_cost: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=10, decimal_places=2)
    min_stock: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=12, decimal_places=3)
    notes: str | None = Field(default=None, max_length=500)


class SupplyRead(BaseModel):
    id: uuid.UUID
    name: str
    unit: str
    unit_cost: Decimal
    min_stock: Decimal | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


# ---------- Supply x on-hand aggregate ----------


class SupplyMini(BaseModel):
    id: uuid.UUID
    name: str
    unit: str


class SupplyLevelRead(BaseModel):
    """A single supply's aggregated on-hand position."""

    supply_id: uuid.UUID
    name: str
    unit: str
    unit_cost: Decimal
    min_stock: Decimal | None = None
    on_hand: Decimal
    entries_total: Decimal
    exits_total: Decimal
    last_movement_at: datetime | None = None


# ---------- Ledger movements ----------


class SupplyMovementCreate(BaseModel):
    supply_id: uuid.UUID
    kind: SupplyMovementKind = Field(default=SupplyMovementKind.ENTRY)
    quantity: Decimal = Field(gt=Decimal("0"), max_digits=12, decimal_places=3)
    notes: str | None = Field(default=None, max_length=500)


class SupplyMovementRead(BaseModel):
    id: uuid.UUID
    supply_id: uuid.UUID
    supply: SupplyMini | None = None
    kind: SupplyMovementKind
    quantity: Decimal
    notes: str | None
    created_at: datetime


# ---------- Filters ----------


class SupplyFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)


class SupplyLevelFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    low_stock_only: bool = False


class SupplyMovementFilters(BaseModel):
    supply_id: uuid.UUID | None = None
    kind: SupplyMovementKind | None = None
    date_from: date | None = None
    date_to: date | None = None


# ---------- Page aliases ----------


SupplyPage = Page[SupplyRead]
SupplyLevelPage = Page[SupplyLevelRead]
SupplyMovementPage = Page[SupplyMovementRead]
