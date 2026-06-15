import uuid

from sqlalchemy import CheckConstraint, Column, ForeignKey, Uuid
from sqlmodel import Field

from models.base import CompanyModel


class AssemblyRun(CompanyModel, table=True):
    """Montagem — a single assembly run that turns a blank piece + a printed
    transfer into a finished product variation (T5).

    Assembly is an action, not a kanban entity: each run is a provenance row
    that anchors the three ledger writes done in one transaction (blank -qty,
    printed -qty, finished StockEntry +qty). See ``services.assembly``.
    """

    __tablename__ = "assembly_runs"
    __table_args__ = (CheckConstraint("quantity > 0", name="quantity_positive"),)

    blank_piece_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("blank_pieces.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    printed_transfer_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("printed_transfers.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    # The finished product variation this run credits (resolved/created from the
    # blank's spec+color+size and the transfer's design via ``make_sku``).
    variation_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("product_variations.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    quantity: int = Field(gt=0)
    # Optional lote the run was assembled for; nulled if the batch is deleted.
    batch_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("batches.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
