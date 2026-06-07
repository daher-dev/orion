"""Pydantic schemas for the Batches (Lotes de produção) feature.

A ``Batch`` groups orders for one production/dispatch run. The detail shape
embeds the per-stamp print adjustments so the adjustment screen renders without
follow-up fetches; the list shape stays lean.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from models.enums import BatchStatus
from schemas._common import Page


class BatchCreate(BaseModel):
    """Body of ``POST /v1/batches`` — the operator picks a set of orders.

    Sibling order lines sharing the same ``external_order_id`` are auto-included
    server-side so a multi-line order is never split across batches.
    """

    order_ids: list[uuid.UUID] = Field(min_length=1)
    name: str | None = Field(default=None, max_length=120)


class BatchAdjustmentRow(BaseModel):
    """One stamp/colour print-quantity decision inside a batch."""

    print_design_id: uuid.UUID
    qty_to_print: int = Field(ge=0)


class BatchAdjustmentUpdate(BaseModel):
    """Body of ``PATCH /v1/batches/{id}/adjustments``."""

    adjustments: list[BatchAdjustmentRow] = Field(default_factory=list)


class BatchStatusTransition(BaseModel):
    """Body of ``POST /v1/batches/{id}/status``."""

    status: BatchStatus


class BatchAdjustmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    print_design_id: uuid.UUID
    print_design_code: str | None = None
    print_design_name: str | None = None
    product_color: str
    qty_needed: int
    qty_stock: int
    qty_to_print: int
    prints_sent: bool


class BatchListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str | None = None
    status: BatchStatus
    total_orders: int
    total_pieces: int
    created_at: datetime


class BatchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str | None = None
    status: BatchStatus
    total_orders: int
    total_pieces: int
    labels_printed_at: datetime | None = None
    prints_sent_at: datetime | None = None
    completed_at: datetime | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    adjustments: list[BatchAdjustmentRead] = Field(default_factory=list)


class MontadorSendResult(BaseModel):
    """Summary returned by the Montador DTF send."""

    total: int
    succeeded: int
    failed: int
    results: list[dict]


BatchPage = Page[BatchListItem]


__all__ = [
    "BatchAdjustmentRead",
    "BatchAdjustmentRow",
    "BatchAdjustmentUpdate",
    "BatchCreate",
    "BatchListItem",
    "BatchPage",
    "BatchRead",
    "BatchStatusTransition",
    "MontadorSendResult",
]
