"""Pydantic schemas for the Orders (Pedidos) feature.

An ``Order`` ties a ``Client`` to an ``Ad`` (which knows the channel + the
product) and to a ``ProductVariation`` (size + color). The wire shape
embeds enough joins so the multi-channel list and the detail page can
render without follow-up fetches.

Status transitions are validated server-side; clients hit
``POST /v1/orders/{id}/status`` with the new value. Direct PATCH on
``status`` is also accepted (mirrors the cutting/sewing patterns) but the
dedicated endpoint exists so the UI can attach side effects (stock exit
on ``shipped``, stock entry on ``returned``) without leaking those into
``OrderUpdate``.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from models.enums import Ecommerce, OrderStatus, Size
from schemas._common import Page


class OrderCreate(BaseModel):
    ad_id: uuid.UUID
    variation_id: uuid.UUID
    client_id: uuid.UUID
    quantity: int = Field(gt=0)
    sale_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    ordered_at: datetime
    external_order_id: str | None = Field(default=None, max_length=120)


class OrderUpdate(BaseModel):
    """Partial update — fields the operator may correct without going through
    the status-transition endpoint. ``status`` is also accepted here for
    convenience, but the transition endpoint is the documented surface
    when side effects matter.
    """

    status: OrderStatus | None = None
    sale_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    ordered_at: datetime | None = None
    external_order_id: str | None = Field(default=None, max_length=120)
    quantity: int | None = Field(default=None, gt=0)


class OrderStatusTransition(BaseModel):
    """Body of ``POST /v1/orders/{id}/status``."""

    status: OrderStatus


class OrderAdRead(BaseModel):
    """Minimal ad projection embedded in OrderRead — surfaces the channel."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    ecommerce: Ecommerce


class OrderProductMini(BaseModel):
    """Product projection nested inside ``OrderRead.variation.product``."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    # spec.code — the canonical short identifier ("CAM01" et al).
    code: str | None = None
    image_url: str | None = None


class OrderVariationRead(BaseModel):
    """Variation projection embedded in OrderRead."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sku: str
    size: Size
    color: str
    color_code: str
    product: OrderProductMini


class OrderClientRead(BaseModel):
    """Minimal client projection embedded in OrderRead."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str | None = None


class OrderRead(BaseModel):
    id: uuid.UUID
    ad: OrderAdRead
    variation: OrderVariationRead
    client: OrderClientRead
    quantity: int
    sale_price: Decimal
    ordered_at: datetime
    status: OrderStatus
    external_order_id: str | None = None
    created_at: datetime
    updated_at: datetime


class OrderFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    status: OrderStatus | None = None
    channel: Ecommerce | None = None
    client_id: uuid.UUID | None = None
    ad_id: uuid.UUID | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None


OrderPage = Page[OrderRead]


__all__ = [
    "OrderAdRead",
    "OrderClientRead",
    "OrderCreate",
    "OrderFilters",
    "OrderPage",
    "OrderProductMini",
    "OrderRead",
    "OrderStatusTransition",
    "OrderUpdate",
    "OrderVariationRead",
]
