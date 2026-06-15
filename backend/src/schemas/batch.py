"""Pydantic schemas for the Batches (Lotes de produção) feature.

A ``Batch`` groups orders for one production/dispatch run. The detail and list
shapes both stay lean — the per-estampa production grid is computed live in a
later phase, not embedded here.
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


class BatchStatusTransition(BaseModel):
    """Body of ``POST /v1/batches/{id}/status``."""

    status: BatchStatus


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
    completed_at: datetime | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


BatchPage = Page[BatchListItem]


__all__ = [
    "BatchCreate",
    "BatchListItem",
    "BatchPage",
    "BatchRead",
    "BatchStatusTransition",
]
