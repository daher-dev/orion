"""Schemas for the Upseller marketplace order import.

One-shot contract: ``POST /v1/orders/import/upseller`` accepts the CSV
exported from Upseller (multipart) and, in a single call, parses it,
strict-matches each line against the tenant catalog, and persists an
:class:`~models.order.Order` (+ a linked
:class:`~models.imported_order.ImportedOrder`) per matched row. The
response is a :class:`UpsellerImportSummary` carrying counts plus a
per-row ``errors`` list so unmatched lines are visible.

``dry_run`` performs the parse + match without writing anything — the
summary then reports what *would* be created.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class UpsellerImportError(BaseModel):
    """A source row that could not be persisted, with the reason."""

    row_index: int = Field(ge=0)
    message: str
    platform_order_id: str | None = None
    sku: str | None = None


class UpsellerImportSummary(BaseModel):
    """Outcome of an import run (or a dry-run preview)."""

    total: int = Field(ge=0)
    created: int = Field(ge=0)
    skipped_duplicates: int = Field(ge=0)
    errors: list[UpsellerImportError] = Field(default_factory=list)
    dry_run: bool = False


__all__ = [
    "UpsellerImportError",
    "UpsellerImportSummary",
]
