"""Pydantic schemas for the Ads (anúncios) feature.

An Ad is an ecommerce listing that sells one or more catalog Products
(many-to-many). The wire shape is symmetric on create/update (PATCH allows
partials); ``product_ids`` is the full set of products the listing offers
(update replaces the set). The read shape embeds the product mini-cards so
the grid renders without a second fetch.
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
    product_ids: list[uuid.UUID] = Field(min_length=1)


class AdUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    ecommerce: Ecommerce | None = None
    external_id: str | None = Field(default=None, max_length=120)
    # When present, the full product set is replaced with these ids.
    product_ids: list[uuid.UUID] | None = Field(default=None, min_length=1)


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
    products: list[AdProductMini]
    created_at: datetime
    updated_at: datetime


class AdFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    ecommerce: Ecommerce | None = None
    product_id: uuid.UUID | None = None  # ads containing this product


AdPage = Page[AdRead]
