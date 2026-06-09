"""Schemas for the order separation / labeling / check-out workflow (Separação).

The separation workflow turns an order into one printable 100x50mm label per
physical piece, then lets an operator scan each label's QR (the per-piece
``tracking_code``) to confirm the piece at check-out.

- :class:`SeparationLabel` is the printable label payload (one per piece).
- :class:`GenerateLabelsResponse` wraps the order's labels after materializing
  and flipping them to ``label_printed``.
- :class:`ScanCheckRequest` / :class:`ScanCheckResponse` drive the scan-to-check
  endpoint keyed by ``tracking_code``.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from models.enums import SeparationStatus, Size


class SeparationLabel(BaseModel):
    """A single printable 100x50mm separation label (one physical piece).

    ``qr_data`` is what the QR encodes — the per-piece ``tracking_code`` —
    so a scanner reads it straight back into the scan-check endpoint.
    """

    model_config = ConfigDict(from_attributes=True)

    item_id: uuid.UUID
    order_id: uuid.UUID
    order_code: str
    tracking_code: str
    qr_data: str
    item_index: int
    total_items: int
    status: SeparationStatus
    sku: str | None = None
    product_name: str | None = None
    color: str | None = None
    color_code: str | None = None
    size: Size | None = None
    mapped_print: str | None = None


class GenerateLabelsResponse(BaseModel):
    """Result of generating/printing an order's separation labels."""

    order_id: uuid.UUID
    order_code: str
    total_items: int
    labels: list[SeparationLabel]


class ScanCheckRequest(BaseModel):
    """Scan-to-check a single piece by its label's tracking code."""

    tracking_code: str = Field(min_length=1, max_length=120)


class ScanCheckResponse(BaseModel):
    """Result of a scan-check: the now-checked piece + check-out audit."""

    model_config = ConfigDict(from_attributes=True)

    item_id: uuid.UUID
    order_id: uuid.UUID
    tracking_code: str
    status: SeparationStatus
    item_index: int
    total_items: int
    checked_at: datetime | None = None
    checked_by: str | None = None
    already_checked: bool = False
