"""Pydantic schemas for the Products (catálogo) feature.

A Product is the catalog leaf: spec + optional print + N variations.
The wire shape is the same on create and update, except that PATCH bodies
allow partial keys; ``variations`` is optional on update and, when present,
is treated as a full replacement of the variation list.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from models.enums import ProductType, Size
from schemas._common import Page


class VariationItem(BaseModel):
    """A single (size, color) cell of a product matrix.

    ``sku`` is never accepted on the wire — it is derived in the service
    via ``Product.make_sku``.
    """

    size: Size
    color: str = Field(min_length=1, max_length=40)
    color_code: str = Field(min_length=3, max_length=3)

    @field_validator("color_code")
    @classmethod
    def _color_code_is_uppercase_letters(cls, value: str) -> str:
        if not value.isalpha() or not value.isupper():
            raise ValueError("color_code must be three uppercase letters")
        return value


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    product_type: ProductType
    spec_id: uuid.UUID
    print_id: uuid.UUID | None = None
    variations: list[VariationItem] = Field(min_length=1)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    product_type: ProductType | None = None
    spec_id: uuid.UUID | None = None
    print_id: uuid.UUID | None = None
    variations: list[VariationItem] | None = Field(default=None, min_length=1)


class VariationRead(BaseModel):
    id: uuid.UUID
    size: Size
    color: str
    color_code: str
    sku: str
    created_at: datetime
    updated_at: datetime


class ProductRead(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    name: str
    product_type: ProductType
    spec_id: uuid.UUID
    print_id: uuid.UUID | None = None
    variations: list[VariationRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ProductFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    product_type: ProductType | None = None
    spec_id: uuid.UUID | None = None
    print_id: uuid.UUID | None = None


class ProductPage(Page[ProductRead]):
    pass
