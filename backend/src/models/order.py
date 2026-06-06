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
        # NULL-safe: passes when sale_price is NULL (marketplace imports).
        CheckConstraint("sale_price >= 0", name="sale_price_non_negative"),
        # The same external order number can repeat across an order's line
        # items (a multi-item marketplace order shares one platform order id),
        # so the natural key includes the variation — a given (ad, variation)
        # pair still can't appear twice under one external order id.
        Index(
            "uq_orders_company_id_ad_id_variation_id_external_order_id",
            "company_id",
            "ad_id",
            "variation_id",
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
    # Nullable: marketplace imports (Upseller) carry no buyer identity. Manual
    # order creation still requires a client — that is enforced at the schema
    # layer (OrderCreate), not the column.
    client_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("clients.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
    )
    # Nullable: an order belongs to at most one production batch (lote). SET NULL
    # so deleting a batch unlinks its orders rather than cascading them away.
    batch_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("batches.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    quantity: int = Field(gt=0)
    # Nullable: marketplace imports carry no price. Backfilled later via update.
    sale_price: Decimal | None = Field(default=None, max_digits=12, decimal_places=2, ge=0)
    ordered_at: datetime = Field(sa_type=DateTime(timezone=True))
    status: OrderStatus = Field(default=OrderStatus.PENDING, sa_type=ORDER_STATUS)
    external_order_id: str | None = Field(default=None, max_length=120)
