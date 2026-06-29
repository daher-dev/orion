"""Schemas for the marketplace SKU De/Para (``SkuMapping``).

An operator resolves an unmatched import line by pinning its marketplace SKU to
an internal ad + variation; that decision is persisted and consulted SKU-first
on every later import. ``SkuMappingCreate`` is the resolver's write; the read
carries back the resolved catalog context so the UI can confirm the pin.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.enums import Ecommerce, Size


class SkuMappingCreate(BaseModel):
    """Pin a marketplace SKU to an internal ad + variation."""

    marketplace: Ecommerce
    sku: str = Field(min_length=1, max_length=120)
    ad_id: uuid.UUID
    variation_id: uuid.UUID


class SkuMappingRead(BaseModel):
    """A stored De/Para entry, enriched with the resolved catalog context."""

    id: uuid.UUID
    marketplace: Ecommerce
    sku: str
    ad_id: uuid.UUID
    variation_id: uuid.UUID
    source: str
    created_at: datetime
    # Resolved context (best-effort; null if the row was orphaned by a delete).
    ad_title: str | None = None
    product_name: str | None = None
    variation_sku: str | None = None
    color: str | None = None
    size: Size | None = None


class SkuMappingPage(BaseModel):
    items: list[SkuMappingRead]
    total: int


__all__ = [
    "SkuMappingCreate",
    "SkuMappingPage",
    "SkuMappingRead",
]
