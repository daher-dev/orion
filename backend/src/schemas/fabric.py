"""Pydantic schemas for the Fabric (bobinas) feature.

`FabricRollRead` carries every persisted column plus a computed `consumed_kg`
field so the frontend doesn't need to subtract by itself. Decimal columns are
serialized as strings (FastAPI / Pydantic default) — the frontend zod layer
mirrors that contract.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from models.enums import FabricRollKind, FabricType
from schemas._common import Page


class FabricRollCreate(BaseModel):
    received_at: date
    supplier_name: str = Field(min_length=1, max_length=120)
    kind: FabricRollKind
    fabric_type: FabricType
    initial_weight_kg: Decimal = Field(gt=Decimal("0"), max_digits=10, decimal_places=3)
    color: str = Field(min_length=1, max_length=40)
    price_per_kg: Decimal = Field(ge=Decimal("0"), max_digits=10, decimal_places=2)
    # Optional — defaults to `initial_weight_kg` at insert when omitted.
    current_weight_kg: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=10, decimal_places=3)


class FabricRollUpdate(BaseModel):
    received_at: date | None = None
    supplier_name: str | None = Field(default=None, min_length=1, max_length=120)
    kind: FabricRollKind | None = None
    fabric_type: FabricType | None = None
    initial_weight_kg: Decimal | None = Field(default=None, gt=Decimal("0"), max_digits=10, decimal_places=3)
    current_weight_kg: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=10, decimal_places=3)
    color: str | None = Field(default=None, min_length=1, max_length=40)
    price_per_kg: Decimal | None = Field(default=None, ge=Decimal("0"), max_digits=10, decimal_places=2)


class FabricRollRead(BaseModel):
    id: uuid.UUID
    received_at: date
    supplier_name: str
    kind: FabricRollKind
    fabric_type: FabricType
    initial_weight_kg: Decimal
    current_weight_kg: Decimal
    consumed_kg: Decimal
    color: str
    price_per_kg: Decimal
    created_at: datetime
    updated_at: datetime


class FabricRollFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    kind: FabricRollKind | None = None
    fabric_type: FabricType | None = None


FabricRollPage = Page[FabricRollRead]
