import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Uuid, text
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import SeparationStatus
from models.pg_enums import SEPARATION_STATUS


class OrderItem(CompanyModel, table=True):
    """A single physical piece within an order — the separation/picking unit.

    Carries the per-piece tracking code (QR), separation-workflow status, the
    check-out audit (who/when), and the mapped print (estampa). Imported from
    the legacy ``ItemPedido`` and the data layer for the Separação feature.
    """

    __tablename__ = "order_items"
    __table_args__ = (
        # Real tracking codes are globally unique per tenant; NULLs (unresolved
        # pieces) may repeat — partial unique, mirroring Order.external_order_id.
        Index(
            "uq_order_items_company_id_tracking_code",
            "company_id",
            "tracking_code",
            unique=True,
            postgresql_where=text("tracking_code IS NOT NULL"),
        ),
        CheckConstraint("item_index >= 0", name="item_index_non_negative"),
        CheckConstraint("total_items >= 0", name="total_items_non_negative"),
    )

    order_id: uuid.UUID = Field(
        sa_column=Column(Uuid, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True),
    )
    # Nullable: a piece may not resolve to a catalog variation (unmapped size/color).
    variation_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(Uuid, ForeignKey("product_variations.id", ondelete="RESTRICT"), nullable=True, index=True),
    )
    tracking_code: str | None = Field(default=None, max_length=120)
    status: SeparationStatus = Field(default=SeparationStatus.PENDING, sa_type=SEPARATION_STATUS)
    checked_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    checked_by: str | None = Field(default=None, max_length=255)
    mapped_print: str | None = Field(default=None, max_length=120)
    item_index: int = Field(default=0, ge=0)
    total_items: int = Field(default=0, ge=0)
