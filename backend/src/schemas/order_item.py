"""Read schema for an order's per-piece separation items (Separação)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from models.enums import SeparationStatus


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_id: uuid.UUID
    variation_id: uuid.UUID | None
    tracking_code: str | None
    status: SeparationStatus
    checked_at: datetime | None
    checked_by: str | None
    mapped_print: str | None
    item_index: int
    total_items: int
