import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field

from models.base import BaseModel, CompanyModel
from models.enums import PrintOrderStatus, PrintSide
from models.pg_enums import PRINT_ORDER_STATUS, PRINT_SIDE


class PrintOrder(CompanyModel, table=True):
    """Ordem de impressão — a request to print estampa transfers (T4).

    Mirrors ``CuttingOrder``: a per-design print job with a status machine
    (pending → printing → done) and per-side/variation planned vs printed
    counts (``PrintOrderOutput``). Completing the order ("Lançar impressos")
    debits the attached paper roll's meters and credits printed transfers
    (design+side, summed across variations) — see ``services.print_order``.
    """

    __tablename__ = "print_orders"

    print_design_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("print_designs.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    # The paper/film roll consumed when the order is completed. Optional: an
    # order may be created before a roll is assigned; if still null on complete
    # the meters are recorded on the order but no paper movement is written.
    paper_roll_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("paper_rolls.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
    )
    status: PrintOrderStatus = Field(default=PrintOrderStatus.PENDING, sa_type=PRINT_ORDER_STATUS)
    # Completion watermark — set once on "Lançar impressos". Non-null guards
    # against double-crediting printed transfers / re-debiting paper.
    printed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    # Meters of paper actually consumed by this order (recorded on complete).
    meters_consumed: Decimal | None = Field(default=None, max_digits=10, decimal_places=2)


class PrintOrderOutput(BaseModel, table=True):
    """Per-(side, variation) planned vs printed count for a print order.

    Mirrors ``CuttingOrderOutput``. One row per ``(order, variation, side)``;
    ``printed_quantity`` is filled in as the operator records the run and may
    never exceed ``planned_quantity`` (enforced by a check constraint).
    """

    __tablename__ = "print_order_outputs"
    __table_args__ = (
        UniqueConstraint(
            "print_order_id",
            "print_design_variation_id",
            "side",
            name="uq_print_order_outputs_order_variation_side",
        ),
        CheckConstraint("planned_quantity >= 0", name="planned_quantity_non_negative"),
        CheckConstraint("printed_quantity >= 0", name="printed_quantity_non_negative"),
        CheckConstraint("printed_quantity <= planned_quantity", name="printed_within_planned"),
    )

    print_order_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("print_orders.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    print_design_variation_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("print_design_variations.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    side: PrintSide = Field(sa_type=PRINT_SIDE)
    planned_quantity: int = Field(ge=0)
    printed_quantity: int = Field(default=0, ge=0)
