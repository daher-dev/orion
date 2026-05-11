"""Pydantic shapes for the Sewing (remessas) feature.

A sewing shipment is a bundle of cut pieces sent from the factory to a
banca (contractor). The banca delivers (possibly partially) and the
received pieces become stock entries automatically.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from models.enums import ShipmentStatus, Size
from schemas._common import Page


class ShipmentItemInput(BaseModel):
    """One per-size line in the create payload."""

    size: Size
    requested_quantity: int = Field(ge=0)


class ShipmentItemReceiveInput(BaseModel):
    """One per-size line in the receive payload."""

    size: Size
    received_quantity: int = Field(ge=0)


class ShipmentItemRead(BaseModel):
    id: uuid.UUID
    size: Size
    requested_quantity: int
    received_quantity: int


class ShipmentCuttingOrderRead(BaseModel):
    """Inline cutting-order metadata embedded in ShipmentRead."""

    id: uuid.UUID
    code: str


class ShipmentContractorRead(BaseModel):
    """Inline contractor metadata embedded in ShipmentRead."""

    id: uuid.UUID
    name: str


class ShipmentCreate(BaseModel):
    cutting_order_id: uuid.UUID
    contractor_id: uuid.UUID
    sent_at: date
    items: list[ShipmentItemInput] = Field(min_length=1)

    @field_validator("items")
    @classmethod
    def _items_unique_sizes_and_positive(cls, items: list[ShipmentItemInput]) -> list[ShipmentItemInput]:
        sizes = [item.size for item in items]
        if len(set(sizes)) != len(sizes):
            raise ValueError("Each size may appear only once in items")
        if not any(item.requested_quantity > 0 for item in items):
            raise ValueError("At least one item must have a quantity greater than zero")
        return items


class ShipmentReceiveBody(BaseModel):
    received_at: date
    items: list[ShipmentItemReceiveInput] = Field(min_length=1)

    @field_validator("items")
    @classmethod
    def _items_unique_sizes(
        cls,
        items: list[ShipmentItemReceiveInput],
    ) -> list[ShipmentItemReceiveInput]:
        sizes = [item.size for item in items]
        if len(set(sizes)) != len(sizes):
            raise ValueError("Each size may appear only once in receive items")
        return items


class ShipmentRead(BaseModel):
    """Eager-loaded shipment representation for the API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cutting_order: ShipmentCuttingOrderRead
    contractor: ShipmentContractorRead
    status: ShipmentStatus
    sent_at: date
    received_at: date | None
    items: list[ShipmentItemRead]
    created_at: datetime
    updated_at: datetime


class ShipmentFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    status: ShipmentStatus | None = None
    contractor_id: uuid.UUID | None = None
    cutting_order_id: uuid.UUID | None = None


ShipmentPage = Page[ShipmentRead]
