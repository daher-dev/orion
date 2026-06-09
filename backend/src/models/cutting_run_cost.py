import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, ForeignKey, Numeric, Uuid
from sqlmodel import Field

from models.base import CompanyModel


class CuttingRunCost(CompanyModel, table=True):
    """Custo de produção — a frozen cost breakdown for one cutting order.

    Computed once, at the moment a :class:`CuttingOrder` transitions to
    ``DONE``, from the product spec's cost inputs, the fabric-roll prices,
    and the total number of pieces actually cut. Every input that feeds the
    breakdown (per-kg prices, weights, piece count) is persisted on the row
    so the record is an immutable historical snapshot — later edits to the
    spec, its trims, or the fabric-roll prices do **not** retroactively
    change a past run's cost.

    One row per cutting order (``cutting_order_id`` is UNIQUE). The row is
    upserted (deleted and re-created) on every DONE transition; reverting an
    order to CUTTING keeps the last computed cost until it is re-marked DONE.
    """

    __tablename__ = "cutting_run_costs"
    __table_args__ = (
        CheckConstraint("total_pieces >= 0", name="total_pieces_non_negative"),
        CheckConstraint("body_fabric_kg >= 0", name="body_fabric_kg_non_negative"),
        CheckConstraint("ribana_kg >= 0", name="ribana_kg_non_negative"),
        CheckConstraint("fabric_cost >= 0", name="fabric_cost_non_negative"),
        CheckConstraint("ribana_cost >= 0", name="ribana_cost_non_negative"),
        CheckConstraint("trims_cost >= 0", name="trims_cost_non_negative"),
        CheckConstraint("labor_cost >= 0", name="labor_cost_non_negative"),
        CheckConstraint("total_cost >= 0", name="total_cost_non_negative"),
        CheckConstraint("cost_per_piece >= 0", name="cost_per_piece_non_negative"),
        CheckConstraint("yield_pieces_per_kg >= 0", name="yield_pieces_per_kg_non_negative"),
    )

    cutting_order_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("cutting_orders.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        ),
    )

    #: Total pieces actually cut (sum of CuttingOrderOutput.quantity).
    total_pieces: int = Field(ge=0)

    #: Consumed weights, derived from spec inputs (not roll-weight deltas).
    body_fabric_kg: Decimal = Field(sa_column=Column(Numeric(10, 3), nullable=False))
    ribana_kg: Decimal = Field(sa_column=Column(Numeric(10, 3), nullable=False))

    #: Per-kg price snapshots taken from the fabric rolls at compute time.
    body_price_per_kg: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    rib_price_per_kg: Decimal | None = Field(default=None, sa_column=Column(Numeric(10, 2), nullable=True))

    #: Cost components and totals (BRL).
    fabric_cost: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    ribana_cost: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    trims_cost: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    labor_cost: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    total_cost: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    cost_per_piece: Decimal = Field(sa_column=Column(Numeric(12, 4), nullable=False))

    #: Rendimento — pieces produced per kg of fabric consumed.
    yield_pieces_per_kg: Decimal = Field(sa_column=Column(Numeric(10, 3), nullable=False))
