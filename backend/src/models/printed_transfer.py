import uuid

from sqlalchemy import CheckConstraint, Column, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import PrintedMovementKind, PrintSide
from models.pg_enums import PRINT_SIDE, PRINTED_MOVEMENT_KIND


class PrintedTransfer(CompanyModel, table=True):
    """Estampado — a printed transfer (estampa applied to film) in stock.

    Replaces the old ``print_stock`` tier: keyed by ``(print_design, side)`` via
    a real FK (not the old free-text ``product_color``). The on-hand quantity is
    NOT stored here; it is derived live from the append-only
    ``printed_transfer_movements`` ledger (see ``services.printed_transfer``).
    """

    __tablename__ = "printed_transfers"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "print_design_id",
            "side",
            name="uq_printed_transfers_company_id_print_design_id_side",
        ),
        CheckConstraint("min_stock IS NULL OR min_stock >= 0", name="min_stock_non_negative"),
    )

    print_design_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("print_designs.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    side: PrintSide = Field(sa_type=PRINT_SIDE)
    # Optional reorder threshold; when set, on-hand at or below it flags low stock.
    min_stock: int | None = Field(default=None, ge=0)


class PrintedTransferMovement(CompanyModel, table=True):
    """Append-only ledger row for a printed transfer.

    A single table carries a ``kind`` enum; ENTRY and ADJUSTMENT credit stock,
    EXIT debits it (every row holds a strictly-positive ``quantity``). On-hand
    is the signed sum of these rows per printed transfer — no materialised
    balance column. (The old ``batch_id`` provenance was dropped with the
    ``print_stock`` table.) A row is credited by completing a print order (T4,
    ``print_order_id``) or debited by an assembly run (T5, ``assembly_run_id``);
    both are null on manual movements.
    """

    __tablename__ = "printed_transfer_movements"
    __table_args__ = (CheckConstraint("quantity > 0", name="quantity_positive"),)

    printed_transfer_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("printed_transfers.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    kind: PrintedMovementKind = Field(sa_type=PRINTED_MOVEMENT_KIND)
    quantity: int = Field(gt=0)
    # Provenance: T4 credit (print order complete) / T5 debit (assembly run).
    print_order_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("print_orders.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    assembly_run_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("assembly_runs.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    notes: str | None = Field(default=None, max_length=500)
