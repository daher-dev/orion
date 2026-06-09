"""Pydantic response schema for the per-run production cost record.

A :class:`CuttingRunCost` is computed once when a cutting order is marked
``DONE`` and frozen thereafter. The wire shape mirrors the cost-breakdown
card on the cutting detail screen: the four cost components (fabric body,
ribana, trims, labor), the rolled-up total, the per-piece cost, and the
yield (pieces per kg of fabric consumed).

Following the Reports convention (``schemas/reports.py``), all money and
weight values are serialised as plain floats; counts stay as ``int``. The
service does the arithmetic in :class:`~decimal.Decimal` and only narrows
to float at this boundary.
"""

from __future__ import annotations

import uuid

from pydantic import BaseModel


class CuttingCostRead(BaseModel):
    cutting_order_id: uuid.UUID

    total_pieces: int

    # Consumed fabric (kg), derived from spec weights x pieces.
    body_fabric_kg: float
    ribana_kg: float

    # Per-kg price snapshots used at compute time.
    body_price_per_kg: float
    rib_price_per_kg: float | None = None

    # Cost components (BRL).
    fabric_cost: float
    ribana_cost: float
    trims_cost: float
    labor_cost: float
    total_cost: float
    cost_per_piece: float

    # Rendimento — pieces per kg of fabric.
    yield_pieces_per_kg: float


__all__ = ["CuttingCostRead"]
