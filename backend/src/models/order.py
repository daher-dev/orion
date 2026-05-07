import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Uuid, text
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import OrderStatus
from models.pg_enums import ORDER_STATUS


class Order(CompanyModel, table=True):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity_positive"),
        CheckConstraint("sale_price >= 0", name="sale_price_non_negative"),
        # Same external order number can't appear twice under the same ad.
        Index(
            "uq_orders_company_id_ad_id_external_order_id",
            "company_id",
            "ad_id",
            "external_order_id",
            unique=True,
            postgresql_where=text("external_order_id IS NOT NULL"),
        ),
    )

    ad_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("ads.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    variation_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("product_variations.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    client_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("clients.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    quantity: int = Field(gt=0)
    sale_price: Decimal = Field(max_digits=12, decimal_places=2, ge=0)
    ordered_at: datetime = Field(sa_type=DateTime(timezone=True))
    status: OrderStatus = Field(default=OrderStatus.PENDING, sa_type=ORDER_STATUS)
    external_order_id: str | None = Field(default=None, max_length=120)
