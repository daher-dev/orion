"""Pydantic schemas for the Batches (Lotes de produção) feature.

A ``Batch`` groups orders for one production/dispatch run. The list shape stays
lean (``BatchListItem``); the detail shape (``BatchDetailRead``) embeds the
per-estampa production grid computed live from the batch's orders + the printed-
transfer / finished-stock ledgers.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from models.enums import BatchStatus
from schemas._common import Page
from schemas.print_order import PrintDesignRef


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


# ---------- detail (computed estampa grid) ----------


class BatchEstampaRow(BaseModel):
    """One row of the lote's per-estampa production grid (computed live).

    Grouped by :class:`PrintDesign`. The ``design`` is ``None`` for the bucket
    of orders whose product has no estampa (``code`` then ``"—"``).

    - ``items`` — pieces (Σ ``order.quantity``) needing this estampa.
    - ``to_print`` — pieces still needing a FRONT printed transfer
      (``max(0, items - front_on_hand)``).
    - ``montado`` — pieces already covered by finished stock; ``is_assembled``
      when it covers ``items``.
    - ``enviado`` — pieces whose order is already SHIPPED; ``is_shipped`` when
      every order in the group is shipped.
    """

    design: PrintDesignRef | None = None
    code: str
    items: int
    to_print: int
    montado: int
    is_assembled: bool
    enviado: int
    is_shipped: bool


class BatchDetailRead(BaseModel):
    """``GET /v1/batches/{id}`` — the lean fields + the computed grid + roll-ups."""

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

    # ---- computed ----
    estampas: list[BatchEstampaRow] = Field(default_factory=list)
    orders_ready: int = 0
    orders_total: int = 0
    pieces_total: int = 0
    to_print_total: int = 0
    needs_assembly: bool = False
    can_ship: bool = False


# ---------- montar / enviar ----------


class BatchAssembleRow(BaseModel):
    """Optional per-design partial-montar request row."""

    design_id: uuid.UUID
    quantity: int = Field(gt=0)


class BatchAssembleBody(BaseModel):
    """Body of ``POST /v1/batches/{id}/assemble``.

    Empty body = assemble everything the grid is short on. ``rows`` restricts the
    montar to specific designs (partial montar).
    """

    rows: list[BatchAssembleRow] | None = None


class BatchAssembledRow(BaseModel):
    variation_id: uuid.UUID
    sku: str
    quantity: int


class BatchAssembleSkipped(BaseModel):
    variation_id: uuid.UUID
    sku: str
    reason: str


class BatchAssembleResult(BaseModel):
    """Result of ``POST /v1/batches/{id}/assemble`` — the recomputed grid + a
    per-variation montar summary (partial failures are skipped, not 409)."""

    batch: BatchDetailRead
    assembled: list[BatchAssembledRow] = Field(default_factory=list)
    skipped: list[BatchAssembleSkipped] = Field(default_factory=list)


__all__ = [
    "BatchAssembleBody",
    "BatchAssembleResult",
    "BatchAssembleRow",
    "BatchAssembleSkipped",
    "BatchAssembledRow",
    "BatchCreate",
    "BatchDetailRead",
    "BatchEstampaRow",
    "BatchListItem",
    "BatchPage",
    "BatchRead",
    "BatchStatusTransition",
]
