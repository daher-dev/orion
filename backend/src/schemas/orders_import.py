"""Schemas for FEATURE-014 — Sales Orders Import.

Two-step contract:

1. ``POST /v1/orders/import/parse`` accepts a PDF or CSV (multipart) and
   returns a :class:`ParseResponse` — a list of :class:`ParsedOrderRow`
   plus an optional free-text ``notes`` field with the parser's own
   commentary (e.g. "the receipt is dated in BRT").
2. ``POST /v1/orders/import/commit`` accepts the user-edited rows
   (potentially with manual corrections) and persists them, returning a
   :class:`CommitOrdersResponse` carrying ``created`` count plus an
   ``errors`` list keyed by ``row_index`` so the UI can show partial
   failures inline.

Confidence is a float in ``[0, 1]``. The CSV parser sets ``1.0`` for
unambiguous header mappings; the LLM parser uses the value the model
reports (defaulting to ``0.8`` for any present field and ``0.0`` for a
missing one).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ImportFormat(StrEnum):
    """Optional hint forced by the caller. ``auto`` lets the service sniff."""

    AUTO = "auto"
    PDF = "pdf"
    CSV = "csv"


class ParsedOrderRow(BaseModel):
    """One review row as returned by ``/parse`` and fed back to ``/commit``."""

    model_config = ConfigDict(extra="ignore")

    row_index: int = Field(ge=0)
    confidence: float = Field(ge=0.0, le=1.0)

    client_name: str | None = Field(default=None, max_length=120)
    client_email: str | None = Field(default=None, max_length=255)
    client_phone: str | None = Field(default=None, max_length=40)

    # Free-text from the source; resolved against Ad.external_id at commit.
    ad_external_id: str | None = Field(default=None, max_length=120)
    # Free-text from the source; resolved against Product / ProductVariation.
    product_hint: str | None = Field(default=None, max_length=200)

    quantity: int | None = Field(default=None, ge=1)
    sale_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    ordered_at: datetime | None = None

    raw_excerpt: str | None = Field(default=None, max_length=500)

    @field_validator("client_email")
    @classmethod
    def _strip_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        v = value.strip().lower()
        return v or None


class ParseResponse(BaseModel):
    rows: list[ParsedOrderRow]
    notes: str | None = None


class CommitOrdersBody(BaseModel):
    rows: list[ParsedOrderRow] = Field(min_length=1)


class CommitOrderError(BaseModel):
    row_index: int = Field(ge=0)
    message: str


class CommitOrdersResponse(BaseModel):
    created: int = Field(ge=0)
    errors: list[CommitOrderError]


__all__ = [
    "CommitOrderError",
    "CommitOrdersBody",
    "CommitOrdersResponse",
    "ImportFormat",
    "ParseResponse",
    "ParsedOrderRow",
]
