"""Pydantic schemas for the Ads (anúncios) feature.

An Ad links a Product in the catalog to an ecommerce channel listing.
The wire shape is symmetric on create/update (PATCH allows partials)
and the read shape embeds a small product mini-card so the grouped
grid in the UI can render without a second fetch.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from models.enums import Ecommerce
from schemas._common import Page


class AdCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    ecommerce: Ecommerce
    external_id: str | None = Field(default=None, max_length=120)
    product_id: uuid.UUID


class AdUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    ecommerce: Ecommerce | None = None
    external_id: str | None = Field(default=None, max_length=120)
    product_id: uuid.UUID | None = None


class AdProductMini(BaseModel):
    """Embedded product information shown on every ad card."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    # ``code`` mirrors the product's spec.code so the grid can render the
    # familiar "FT-014" style code without joining specs on the wire.
    code: str


class AdRead(BaseModel):
    id: uuid.UUID
    title: str
    ecommerce: Ecommerce
    external_id: str | None = None
    product: AdProductMini
    created_at: datetime
    updated_at: datetime


class AdFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    ecommerce: Ecommerce | None = None
    product_id: uuid.UUID | None = None


AdPage = Page[AdRead]
