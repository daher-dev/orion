"""Pydantic schemas for the De/Para mapping feature.

The De/Para resolves each imported :class:`OrderItem` (whose ``variation_id``
is still ``NULL``) to the correct internal Product → Variation (SKU). An item
arrives from the marketplace carrying the ad title plus the marketplace
variation text (``cor · tamanho``); here it is linked to the internal variation
of the right product. The estampa follows from the matched variation's
product (``Product.print_id`` → :class:`PrintDesign`).

Wire shapes:

- :class:`MappingItem` — one De/Para row (pending or linked) with the source
  ad/variation snapshot, the resolved variation (when linked) and an embedded
  best :class:`MappingSuggestion` (when pending and unambiguous).
- :class:`MappingPage` — a page of items plus progress counts so the UI can
  render the progress bar and Pendentes/Vinculados/Todos filter badges without
  follow-up calls.
- :class:`SetVariationBody` — body of the manual swap endpoint.
- :class:`AcceptAllResult` — summary returned by accept-all.
"""

from __future__ import annotations

import uuid
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field

from models.enums import Ecommerce, Size


class MappingFilter(StrEnum):
    """Which slice of De/Para rows to list."""

    PENDING = "pending"
    LINKED = "linked"
    ALL = "all"


class MappingSuggestion(BaseModel):
    """A scored best-guess internal variation for a pending order item."""

    variation_id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    sku: str
    color: str
    size: Size
    print_design_code: str | None = None
    print_design_name: str | None = None
    score: int


class MappingItem(BaseModel):
    """One De/Para row — an OrderItem and how it maps (or could map)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_id: uuid.UUID
    # Source snapshot (from the Ad + the 1:1 ImportedOrder, when present).
    ad_id: uuid.UUID
    ad_title: str
    channel: Ecommerce
    ad_sku: str | None = None
    variation_text: str | None = None

    # Resolution state.
    linked: bool
    variation_id: uuid.UUID | None = None
    sku: str | None = None
    product_id: uuid.UUID | None = None
    product_name: str | None = None
    color: str | None = None
    size: Size | None = None
    print_design_code: str | None = None
    print_design_name: str | None = None

    # Best suggestion for a pending row (None when ambiguous / no overlap).
    suggestion: MappingSuggestion | None = None


class MappingProgress(BaseModel):
    """Counts for the progress bar + filter badges."""

    total: int = 0
    linked: int = 0
    pending: int = 0
    with_suggestion: int = 0


class SetVariationBody(BaseModel):
    """Body of ``POST /v1/mapping/items/{item_id}/variation`` (manual swap)."""

    variation_id: uuid.UUID


class AcceptAllResult(BaseModel):
    """Summary returned by ``POST /v1/mapping/accept-all``."""

    accepted: int = 0


class MappingItemsResponse(BaseModel):
    """Paginated De/Para rows plus the global progress counts.

    Mirrors the shape of :class:`schemas._common.Page` (items/total/page/
    page_size/has_more) but adds the global ``progress`` counts so the UI
    renders the progress bar + filter badges from a single fetch. Counts are
    computed over the whole tenant dataset (never the current page slice).
    """

    items: list[MappingItem] = Field(default_factory=list)
    total: int
    page: int
    page_size: int
    has_more: bool
    progress: MappingProgress = Field(default_factory=MappingProgress)


__all__ = [
    "AcceptAllResult",
    "MappingFilter",
    "MappingItem",
    "MappingItemsResponse",
    "MappingProgress",
    "MappingSuggestion",
    "SetVariationBody",
]
