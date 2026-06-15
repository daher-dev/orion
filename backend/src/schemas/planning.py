"""Pydantic schemas for the Planning (Planejamento) feature — Phase 5.

Planning is a **pure computed service** over the existing fulfillment domain
(orders + order_items) plus the WIP tiers. It surfaces two kinds of production
suggestions — *cortes* (cutting, grouped by ``spec + color_code`` with a per-size
grade) and *impressões* (printing, one per print design, FRONT as the reference
side) — each driven by a dual engine (open-order demand + min-stock reorder),
minus work already in production (WIP).

The two create endpoints take a list of selected suggestion *keys*; the server
recomputes the suggestions inside the transaction and creates **PENDING** cutting
/ print orders with no roll / paper assigned yet (the operator finishes them on
the Corte / Impressão boards). Partial success is allowed — a skipped suggestion
(stale / silkscreen / no variation / …) never rolls back the created ones.

Wire shapes mirror the prototype ``window.OrionDemand.build`` output verbatim;
see ``services.planning`` for the algorithm.
"""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field

from models.enums import ProductType, Size
from schemas.print_order import PrintDesignRef

# String enums for the computed classification fields (plain literals so the
# wire shape matches the prototype exactly and no PG enum is involved).
PlanningState = Literal["pronto", "lisa", "impresso", "ambos"]
SuggestionSource = Literal["demanda", "estoque"]
PngFlag = Literal["ok", "pending"]


# ---------- shared refs ----------


class PlanningSpecRef(BaseModel):
    """Minimal product-spec (ficha técnica) projection embedded in suggestions."""

    id: uuid.UUID
    code: str
    name: str


# ---------- per-demand-SKU breakdown ----------


class PlanningSku(BaseModel):
    """One open-demand SKU ``(design, spec, color_code, size)`` with component availability.

    ``needed`` counts open ``OrderItem`` rows; ``net = max(0, needed - finished)``
    is the quantity that still has to be assembled. ``blank_short`` / ``printed_short``
    say which component is missing; ``buildable = min(net, blank_have, printed_have)``.
    """

    key: str
    design: PrintDesignRef
    spec: PlanningSpecRef
    product_type: ProductType
    color: str
    color_code: str
    size: Size
    needed: int
    finished: int
    net: int
    blank_have: int
    printed_have: int
    blank_short: int
    printed_short: int
    buildable: int
    state: PlanningState
    order_count: int


# ---------- corte suggestions ----------


class PlanningCorteGradeRow(BaseModel):
    """Per-size piece count of a corte suggestion (split into demand vs stock)."""

    size: Size
    qty: int
    demand_qty: int
    stock_qty: int


class PlanningCorte(BaseModel):
    """A suggested cutting order, grouped by ``spec + color_code`` with a per-size grade."""

    key: str  # "{spec_id}|{color_code}"
    spec: PlanningSpecRef
    product_type: ProductType
    color: str
    color_code: str
    total: int
    demand: int
    stock: int
    order_count: int
    grade_rows: list[PlanningCorteGradeRow]
    sources: list[SuggestionSource]


# ---------- impressão suggestions ----------


class PlanningImpressao(BaseModel):
    """A suggested print order, one per print design (FRONT as the reference side)."""

    key: str  # "{print_design_id}"
    design: PrintDesignRef
    total: int
    demand: int
    stock: int
    order_count: int
    png: PngFlag
    sources: list[SuggestionSource]


# ---------- totals ----------


class PlanningTotals(BaseModel):
    toCut: int  # noqa: N815 — wire shape (mirrors the prototype + frontend)
    toPrint: int  # noqa: N815 — wire shape
    cortes: int
    impressoes: int
    demandDriven: int  # noqa: N815 — wire shape
    stockDriven: int  # noqa: N815 — wire shape


class PlanningSuggestions(BaseModel):
    """The whole computed model — returned bare (like ``dashboard/summary``)."""

    skus: list[PlanningSku]
    cortes: list[PlanningCorte]
    impressoes: list[PlanningImpressao]
    totals: PlanningTotals


# ---------- bulk-create: cutting ----------


class PlanningCutCreate(BaseModel):
    keys: list[str] = Field(min_length=1)


class PlanningCutCreated(BaseModel):
    key: str
    cutting_order_id: uuid.UUID
    code: str
    total: int


class PlanningSkipped(BaseModel):
    key: str
    reason: Literal["stale", "spec_not_found"]


class PlanningCutResult(BaseModel):
    created: list[PlanningCutCreated]
    skipped: list[PlanningSkipped]
    created_count: int


# ---------- bulk-create: printing ----------


class PlanningPrintCreate(BaseModel):
    keys: list[str] = Field(min_length=1)


class PlanningPrintCreated(BaseModel):
    key: str
    print_order_id: uuid.UUID
    code: str
    total: int


class PlanningPrintSkipped(BaseModel):
    key: str
    reason: Literal["stale", "no_variation", "no_front_side", "silkscreen"]


class PlanningPrintResult(BaseModel):
    created: list[PlanningPrintCreated]
    skipped: list[PlanningPrintSkipped]
    created_count: int


__all__ = [
    "PlanningCorte",
    "PlanningCorteGradeRow",
    "PlanningCutCreate",
    "PlanningCutCreated",
    "PlanningCutResult",
    "PlanningImpressao",
    "PlanningPrintCreate",
    "PlanningPrintCreated",
    "PlanningPrintResult",
    "PlanningPrintSkipped",
    "PlanningSkipped",
    "PlanningSku",
    "PlanningSpecRef",
    "PlanningSuggestions",
    "PlanningTotals",
]
