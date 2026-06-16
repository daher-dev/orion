from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, UniqueConstraint
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import BatchStatus
from models.pg_enums import BATCH_STATUS


class Batch(CompanyModel, table=True):
    """Production batch (shown as "lote" in the pt-BR UI) — a group of orders
    packed into one production/dispatch run.

    Orders are linked to a batch via ``Order.batch_id``. A batch aggregates the
    print designs its orders need and drives separation-label printing; its
    per-estampa production grid is computed live from the linked orders.
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
    completed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))

    notes: str | None = Field(default=None, max_length=500)
