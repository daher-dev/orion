import uuid

from sqlalchemy import CheckConstraint, Column, ForeignKey, Index, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import PrintStockDirection
from models.pg_enums import PRINT_STOCK_DIRECTION


class PrintStockMovement(CompanyModel, table=True):
    """Append-only ledger of printed-stamp (estampa impressa) stock movements.

    On-hand is computed live per ``(company, print_design, product_color)`` —
    there is no materialised balance column, mirroring the finished-piece Stock
    feature. ``product_color`` is a FREE-TEXT string matching
    ``ProductVariation.color`` (max_length=80) — it is intentionally NOT an FK,
    so the ledger can be joined to required quantities by colour string.

    ``direction`` carries the sign: ENTRY and ADJUSTMENT credit stock, EXIT
    debits it. ``quantity`` is always strictly positive.
    """

    __tablename__ = "print_stock_movements"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="quantity_positive"),
        Index(
            "ix_print_stock_movements_company_design_color",
            "company_id",
            "print_design_id",
            "product_color",
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
    product_color: str = Field(max_length=80, index=True)
    direction: PrintStockDirection = Field(sa_type=PRINT_STOCK_DIRECTION)
    quantity: int = Field(gt=0)
    notes: str | None = Field(default=None, max_length=500)

    # Optional provenance link: a movement may originate from a production
    # batch (e.g. a print run dispatched for a lote).
    batch_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("batches.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
