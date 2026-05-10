"""Pydantic schemas for the Prints (estampas) feature."""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from schemas._common import Page


class PrintCreate(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=120)
    image_url: str | None = Field(default=None, max_length=512)
    cost_per_unit: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)


class PrintUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=32)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    image_url: str | None = Field(default=None, max_length=512)
    cost_per_unit: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)


class PrintRead(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    code: str
    name: str
    image_url: str | None = None
    cost_per_unit: Decimal
    created_at: datetime
    updated_at: datetime


class PrintFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)


PrintPage = Page[PrintRead]
