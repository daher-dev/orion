import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import BatchStatus
from models.pg_enums import BATCH_STATUS


class Batch(CompanyModel, table=True):
    """Production batch (shown as "lote" in the pt-BR UI) — a group of orders
    packed into one production/dispatch run.

    Orders are linked to a batch via ``Order.batch_id``. A batch aggregates the
    print designs its orders need, lets the operator adjust how many of each to
    print (``BatchPrintAdjustment``), then drives separation-label printing and
    the Montador DTF send.
    """

    __tablename__ = "batches"
    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_batches_company_id_code"),
        CheckConstraint("total_orders >= 0", name="total_orders_non_negative"),
        CheckConstraint("total_pieces >= 0", name="total_pieces_non_negative"),
    )

    # Human-readable code, format BATCH-YYYYMMDD-NNNN. Unique per tenant.
    code: str = Field(max_length=40)
    name: str | None = Field(default=None, max_length=120)
    status: BatchStatus = Field(default=BatchStatus.OPEN, sa_type=BATCH_STATUS)

    total_orders: int = Field(default=0, ge=0)
    total_pieces: int = Field(default=0, ge=0)

    labels_printed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    prints_sent_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    completed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))

    notes: str | None = Field(default=None, max_length=500)


class BatchPrintAdjustment(CompanyModel, table=True):
    """Per-stamp/colour print adjustment for a batch.

    One row per ``(batch, print_design, product_color)``: how many pieces the
    batch's orders require (``qty_needed``), a stock snapshot, and the operator's
    final decision of how many to print (``qty_to_print``). ``prints_sent`` flips
    to True once the design has been dispatched to the Montador DTF.
    """

    __tablename__ = "batch_print_adjustments"
    __table_args__ = (
        UniqueConstraint(
            "batch_id",
            "print_design_id",
            "product_color",
            name="uq_batch_print_adjustments_design_color",
        ),
        CheckConstraint("qty_needed >= 0", name="qty_needed_non_negative"),
        CheckConstraint("qty_stock >= 0", name="qty_stock_non_negative"),
        CheckConstraint("qty_to_print >= 0", name="qty_to_print_non_negative"),
    )

    batch_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("batches.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    print_design_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("print_designs.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    product_color: str = Field(max_length=80)

    qty_needed: int = Field(default=0, ge=0)
    qty_stock: int = Field(default=0, ge=0)
    qty_to_print: int = Field(default=0, ge=0)
    prints_sent: bool = Field(default=False)
