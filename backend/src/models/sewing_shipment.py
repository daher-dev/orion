import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Column, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field

from models.base import BaseModel, CompanyModel
from models.enums import ShipmentStatus, Size
from models.pg_enums import SHIPMENT_STATUS, SIZE


class SewingShipment(CompanyModel, table=True):
    """Remessa — a batch of cut pieces sent to a sewing contractor (banca)."""

    __tablename__ = "sewing_shipments"

    cutting_order_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("cutting_orders.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    contractor_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("sewing_contractors.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    sent_at: date
    received_at: date | None = Field(default=None)
    status: ShipmentStatus = Field(default=ShipmentStatus.SENT, sa_type=SHIPMENT_STATUS)


class SewingShipmentItem(BaseModel, table=True):
    """Per-size requested/received counts for a sewing shipment."""

    __tablename__ = "sewing_shipment_items"
    __table_args__ = (
        UniqueConstraint("shipment_id", "size", name="uq_sewing_shipment_items_shipment_id_size"),
        CheckConstraint("requested_quantity >= 0", name="requested_non_negative"),
        CheckConstraint("received_quantity >= 0", name="received_non_negative"),
        CheckConstraint("received_quantity <= requested_quantity", name="received_within_requested"),
        CheckConstraint("credited_quantity >= 0", name="credited_non_negative"),
        CheckConstraint("credited_quantity <= received_quantity", name="credited_within_received"),
    )

    shipment_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("sewing_shipments.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    size: Size = Field(sa_type=SIZE)
    requested_quantity: int = Field(ge=0)
    received_quantity: int = Field(default=0, ge=0)
    # How much of ``received_quantity`` has already been posted to blank stock
    # (T3 delta-credit watermark). The next receive credits only
    # ``received_quantity - credited_quantity``.
    credited_quantity: int = Field(default=0, ge=0)
