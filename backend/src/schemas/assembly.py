"""Pydantic schemas for the Assembly (Montagem · T5) feature.

Assembly is an *action* (not a kanban entity): a blank piece + a printed
transfer are combined into a finished product variation. ``AssembleBody`` drives
the one-transaction transition; ``AssemblyRunRead`` echoes the resolved/created
SKU. ``BuildableRow`` is the on-hand discovery assist (computed live, no writes):
every ``(printed_transfer, candidate blank)`` pair with positive on-hand, with
``max_buildable = min(blank.on_hand, printed_on_hand)``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.enums import PrintSide, ProductType
from schemas._common import Page
from schemas.print_order import PrintDesignRef


class AssembleBody(BaseModel):
    blank_piece_id: uuid.UUID
    printed_transfer_id: uuid.UUID
    quantity: int = Field(gt=0)
    batch_id: uuid.UUID | None = None


class AssemblyVariationRef(BaseModel):
    id: uuid.UUID
    sku: str
    size: str
    color: str
    color_code: str


class AssemblyRunRead(BaseModel):
    id: uuid.UUID
    blank_piece_id: uuid.UUID
    printed_transfer_id: uuid.UUID
    variation: AssemblyVariationRef
    sku: str
    quantity: int
    created_new_variation: bool
    batch_id: uuid.UUID | None = None
    created_at: datetime


# ---------- buildable (from live on-hand) ----------


class BuildableSpecRef(BaseModel):
    id: uuid.UUID
    code: str
    name: str


class BuildableBlankRef(BaseModel):
    blank_piece_id: uuid.UUID
    spec: BuildableSpecRef
    size: str
    color: str
    color_code: str
    on_hand: int


class BuildableRow(BaseModel):
    printed_transfer_id: uuid.UUID
    design: PrintDesignRef
    side: PrintSide
    printed_on_hand: int
    blank: BuildableBlankRef
    sku: str
    max_buildable: int
    product_type: ProductType


class BuildableFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    print_design_id: uuid.UUID | None = None
    spec_id: uuid.UUID | None = None


AssemblyBuildablePage = Page[BuildableRow]


__all__ = [
    "AssembleBody",
    "AssemblyBuildablePage",
    "AssemblyRunRead",
    "AssemblyVariationRef",
    "BuildableBlankRef",
    "BuildableFilters",
    "BuildableRow",
    "BuildableSpecRef",
]
