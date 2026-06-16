"""Pydantic schemas for the Print Orders (Impressão · T4) feature.

A ``PrintOrder`` mirrors a ``CuttingOrder``: it is keyed by a transfer-based
``PrintDesign`` plus an optional paper/film roll, with a status machine
(pending → printing → done) and per-``(variation, side)`` planned vs printed
counts.

* ``planned_outputs`` — declared on create, one row per ``(variation, side)``.
* ``printed_outputs`` — set/replaced by the operator via PATCH (mirrors
  cutting's ``actual_outputs`` replace-set); ``printed_quantity`` may never
  exceed the matching ``planned_quantity`` (DB check).

Completing the order ("Lançar impressos") is a separate explicit endpoint that
debits the attached paper roll's meters and credits printed transfers (design +
side, summed across variations). The PATCH only moves status / records counts —
it never posts stock.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from models.enums import PrintOrderStatus, PrintSide, PrintTechnique
from schemas._common import Page

# ---------- create / patch ----------


class PrintOrderOutputItem(BaseModel):
    """A planned ``(variation, side)`` count carried on the create payload."""

    print_design_variation_id: uuid.UUID
    side: PrintSide
    planned_quantity: int = Field(default=0, ge=0)


class PrintOrderOutputItem2(BaseModel):
    """A printed ``(variation, side)`` count carried on the PATCH payload."""

    print_design_variation_id: uuid.UUID
    side: PrintSide
    printed_quantity: int = Field(default=0, ge=0)


class PrintOrderCreate(BaseModel):
    print_design_id: uuid.UUID
    paper_roll_id: uuid.UUID | None = None
    planned_outputs: list[PrintOrderOutputItem] = Field(default_factory=list)

    @model_validator(mode="after")
    def _planned_pairs_unique(self) -> PrintOrderCreate:
        seen: set[tuple[uuid.UUID, PrintSide]] = set()
        for item in self.planned_outputs:
            key = (item.print_design_variation_id, item.side)
            if key in seen:
                raise ValueError(f"duplicate (variation, side) in planned_outputs: {item.side.value}")
            seen.add(key)
        return self


class PrintOrderUpdate(BaseModel):
    status: PrintOrderStatus | None = None
    paper_roll_id: uuid.UUID | None = None
    printed_outputs: list[PrintOrderOutputItem2] | None = None

    @model_validator(mode="after")
    def _printed_pairs_unique(self) -> PrintOrderUpdate:
        if self.printed_outputs is None:
            return self
        seen: set[tuple[uuid.UUID, PrintSide]] = set()
        for item in self.printed_outputs:
            key = (item.print_design_variation_id, item.side)
            if key in seen:
                raise ValueError(f"duplicate (variation, side) in printed_outputs: {item.side.value}")
            seen.add(key)
        return self


class PrintOrderComplete(BaseModel):
    # Optional override; when omitted the service uses rate * total_printed.
    meters_consumed: Decimal | None = Field(default=None, ge=0)


# ---------- read ----------


class PrintDesignRef(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    technique: PrintTechnique
    image_url: str | None = None


class PaperRollRef(BaseModel):
    id: uuid.UUID
    code: str
    paper_type: str


class PrintVariationRef(BaseModel):
    id: uuid.UUID
    name: str
    ink_hex: str


class PrintOrderOutputRead(BaseModel):
    print_design_variation_id: uuid.UUID
    variation: PrintVariationRef
    side: PrintSide
    planned_quantity: int
    printed_quantity: int


class PrintOrderRead(BaseModel):
    id: uuid.UUID
    code: str
    design: PrintDesignRef
    paper_roll: PaperRollRef | None = None
    status: PrintOrderStatus
    technique: PrintTechnique
    rate_m_per_piece: float
    total_planned: int
    total_printed: int
    estimated_meters: float
    meters_consumed: Decimal | None = None
    printed_at: datetime | None = None
    outputs: list[PrintOrderOutputRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class PrintOrderFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    status: PrintOrderStatus | None = None
    print_design_id: uuid.UUID | None = None


PrintOrderPage = Page[PrintOrderRead]


__all__ = [
    "PaperRollRef",
    "PrintDesignRef",
    "PrintOrderComplete",
    "PrintOrderCreate",
    "PrintOrderFilters",
    "PrintOrderOutputItem",
    "PrintOrderOutputItem2",
    "PrintOrderOutputRead",
    "PrintOrderPage",
    "PrintOrderRead",
    "PrintOrderUpdate",
    "PrintVariationRef",
]
