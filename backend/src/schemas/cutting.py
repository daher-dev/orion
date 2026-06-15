"""Pydantic schemas for the Cutting (Corte) feature.

A ``CuttingOrder`` is print-agnostic: it is keyed by a garment base
(``ProductSpec``) plus a free-text colorway (``color`` + 3-letter
``color_code``), one mandatory body roll, and an optional rib roll, plus two
sets of per-size outputs:

* ``planned_outputs`` — declared on create, immutable thereafter through
  the public API (a follow-up edition flow may relax this).
* ``actual_outputs`` — set/replaced by the operator while cutting; the
  service replaces the row set atomically on every PATCH that carries it.

Both lists are sparse: the operator can omit sizes (they are treated as
quantity ``0``). The database enforces uniqueness on
``(cutting_order_id, size)``.

When a cutting order reaches DONE its actual outputs become *available cut
pieces* (computed, not stored). The ``AvailableCut*`` schemas project that
availability per DONE order so the Costura "Disponível" board can draw from it.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from models.enums import CuttingStatus, Size
from schemas._common import Page


class OutputItem(BaseModel):
    """Per-size piece count carried on the create / update payloads."""

    size: Size
    quantity: int = Field(default=0, ge=0)


class CuttingCreate(BaseModel):
    spec_id: uuid.UUID
    color: str = Field(min_length=1, max_length=40)
    color_code: str = Field(pattern=r"^[A-Z]{3}$")
    body_roll_id: uuid.UUID
    rib_roll_id: uuid.UUID | None = None
    planned_outputs: list[OutputItem] = Field(default_factory=list)
    cut_at: datetime | None = None

    @model_validator(mode="after")
    def _rolls_differ(self) -> CuttingCreate:
        # The DB has a CHECK constraint guarding this same invariant, but we
        # short-circuit at the edge so the client gets a clear 422 instead of
        # an opaque IntegrityError converted by the service into a 409.
        if self.rib_roll_id is not None and self.rib_roll_id == self.body_roll_id:
            raise ValueError("body_roll_id and rib_roll_id must be different")
        return self

    @model_validator(mode="after")
    def _planned_sizes_unique(self) -> CuttingCreate:
        seen: set[Size] = set()
        for item in self.planned_outputs:
            if item.size in seen:
                raise ValueError(f"duplicate size in planned_outputs: {item.size.value}")
            seen.add(item.size)
        return self


class CuttingUpdate(BaseModel):
    status: CuttingStatus | None = None
    actual_outputs: list[OutputItem] | None = None
    cut_at: datetime | None = None

    @model_validator(mode="after")
    def _actual_sizes_unique(self) -> CuttingUpdate:
        if self.actual_outputs is None:
            return self
        seen: set[Size] = set()
        for item in self.actual_outputs:
            if item.size in seen:
                raise ValueError(f"duplicate size in actual_outputs: {item.size.value}")
            seen.add(item.size)
        return self


class CuttingOutputRead(BaseModel):
    size: Size
    quantity: int


class SpecRef(BaseModel):
    """Minimal product-spec (ficha técnica) projection embedded in a CuttingRead row."""

    id: uuid.UUID
    code: str
    name: str


class RollRef(BaseModel):
    """Minimal fabric-roll projection embedded in a CuttingRead row."""

    id: uuid.UUID
    # The model does not expose a dedicated ``code`` field; we surface a stable
    # short identifier built from the supplier + fabric type so the UI has
    # something compact to render in tables and kanban cards.
    code: str


class CuttingRead(BaseModel):
    id: uuid.UUID
    spec: SpecRef
    color: str
    color_code: str
    body_roll: RollRef
    rib_roll: RollRef | None = None
    status: CuttingStatus
    planned_outputs: list[CuttingOutputRead] = Field(default_factory=list)
    actual_outputs: list[CuttingOutputRead] = Field(default_factory=list)
    cut_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CuttingFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    status: CuttingStatus | None = None
    spec_id: uuid.UUID | None = None


# ---------- Available cut pieces (T2 input) ----------


class AvailableCutSizeRead(BaseModel):
    size: Size
    available: int


class AvailableCutSpecRead(BaseModel):
    id: uuid.UUID
    code: str
    name: str


class AvailableCutRead(BaseModel):
    """One DONE cutting order with remaining (un-sent) cut pieces per size."""

    cutting_order_id: uuid.UUID
    code: str
    spec: AvailableCutSpecRead
    color: str
    color_code: str
    sizes: list[AvailableCutSizeRead]
    total_available: int


class AvailableCutsFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    spec_id: uuid.UUID | None = None


CuttingPage = Page[CuttingRead]
AvailableCutsPage = Page[AvailableCutRead]


__all__ = [
    "AvailableCutRead",
    "AvailableCutSizeRead",
    "AvailableCutSpecRead",
    "AvailableCutsFilters",
    "AvailableCutsPage",
    "CuttingCreate",
    "CuttingFilters",
    "CuttingOutputRead",
    "CuttingPage",
    "CuttingRead",
    "CuttingUpdate",
    "OutputItem",
    "RollRef",
    "SpecRef",
]
