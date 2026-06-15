import uuid

from sqlalchemy import CheckConstraint, Column, ForeignKey, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import StockExitReason, StockSource
from models.pg_enums import STOCK_EXIT_REASON, STOCK_SOURCE


class StockEntry(CompanyModel, table=True):
    """Pieces flowing into finished stock.

    Sewing no longer credits finished stock (it credits blank pieces in T3);
    finished pieces are now credited by an Assembly (Montagem) run
    (``StockSource.ASSEMBLY``) — the ``assembly_run_id`` provenance FK is
    added in Phase 4.
    """

    __tablename__ = "stock_entries"
    __table_args__ = (CheckConstraint("quantity > 0", name="quantity_positive"),)

    variation_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("product_variations.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    quantity: int = Field(gt=0)
    source: StockSource = Field(sa_type=STOCK_SOURCE)
    notes: str | None = Field(default=None)


class StockExit(CompanyModel, table=True):
    """Pieces flowing out of stock (typically because of a sale)."""

    __tablename__ = "stock_exits"
    __table_args__ = (CheckConstraint("quantity > 0", name="quantity_positive"),)

    variation_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("product_variations.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    order_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("orders.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    quantity: int = Field(gt=0)
    reason: StockExitReason = Field(sa_type=STOCK_EXIT_REASON)
    notes: str | None = Field(default=None)
