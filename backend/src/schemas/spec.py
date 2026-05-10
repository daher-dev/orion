"""Pydantic schemas for the Specs (fichas técnicas) feature."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from models.enums import FabricType, TrimType
from schemas._common import Page


class TrimItem(BaseModel):
    """A single trim row inside a spec — type/quantity/unit price."""

    trim_type: TrimType
    unit_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    quantity: int = Field(default=1, gt=0)


class SpecBase(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=120)
    fabric_type: FabricType
    fabric_grammage_gsm: int = Field(gt=0)
    fabric_weight_per_piece_g: Decimal = Field(gt=0, max_digits=8, decimal_places=2)
    has_ribana: bool = False
    ribana_weight_pct: Decimal | None = Field(default=None, ge=0, le=100, max_digits=5, decimal_places=2)
    labor_cost: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    sale_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    notes: str | None = None


class SpecCreate(SpecBase):
    trims: list[TrimItem] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_ribana(self) -> SpecCreate:
        if self.has_ribana and self.ribana_weight_pct is None:
            raise ValueError("ribana_weight_pct is required when has_ribana is true")
        if not self.has_ribana and self.ribana_weight_pct is not None:
            raise ValueError("ribana_weight_pct must be empty when has_ribana is false")
        return self


class SpecUpdate(BaseModel):
    """Partial update. When `trims` is provided, the entire trim list is replaced atomically."""

    code: str | None = Field(default=None, min_length=1, max_length=20)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    fabric_type: FabricType | None = None
    fabric_grammage_gsm: int | None = Field(default=None, gt=0)
    fabric_weight_per_piece_g: Decimal | None = Field(default=None, gt=0, max_digits=8, decimal_places=2)
    has_ribana: bool | None = None
    ribana_weight_pct: Decimal | None = Field(default=None, ge=0, le=100, max_digits=5, decimal_places=2)
    labor_cost: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    sale_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    notes: str | None = None
    trims: list[TrimItem] | None = None


class SpecRead(SpecBase):
    id: uuid.UUID
    company_id: uuid.UUID
    trims: list[TrimItem] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class SpecFilters(BaseModel):
    q: str | None = None
    fabric_type: FabricType | None = None


class SpecPage(Page[SpecRead]):
    pass
