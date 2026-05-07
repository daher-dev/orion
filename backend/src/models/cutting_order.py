import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field

from models.base import BaseModel, CompanyModel
from models.enums import CuttingStatus, Size
from models.pg_enums import CUTTING_STATUS, SIZE


class CuttingOrder(CompanyModel, table=True):
    """Ordem de corte — a request to cut pieces from raw fabric for a product."""

    __tablename__ = "cutting_orders"
    __table_args__ = (CheckConstraint("body_roll_id <> rib_roll_id", name="body_and_rib_rolls_differ"),)

    product_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    body_roll_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("fabric_rolls.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    rib_roll_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("fabric_rolls.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
    )
    status: CuttingStatus = Field(default=CuttingStatus.PENDING, sa_type=CUTTING_STATUS)
    cut_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))


class CuttingOrderOutput(BaseModel, table=True):
    """Per-size piece count produced by a finished cutting order."""

    __tablename__ = "cutting_order_outputs"
    __table_args__ = (
        UniqueConstraint("cutting_order_id", "size", name="uq_cutting_order_outputs_cutting_order_id_size"),
        CheckConstraint("quantity >= 0", name="quantity_non_negative"),
    )

    cutting_order_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("cutting_orders.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    size: Size = Field(sa_type=SIZE)
    quantity: int = Field(ge=0)
