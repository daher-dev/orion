import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, ForeignKey, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import PaperMovementKind, PaperType
from models.pg_enums import PAPER_MOVEMENT_KIND, PAPER_TYPE


class PaperRoll(CompanyModel, table=True):
    """Bobina de papel/filme — a print-transfer paper/film roll from a supplier.

    Like ``FabricRoll``, the authoritative on-hand is the ``current_meters``
    column (NOT a ledger sum); the ``paper_roll_movements`` ledger records
    history. Consumption clamps at 0.
    """

    __tablename__ = "paper_rolls"
    __table_args__ = (
        CheckConstraint("initial_meters > 0", name="initial_meters_positive"),
        CheckConstraint("current_meters >= 0", name="current_meters_non_negative"),
        CheckConstraint("width_cm > 0", name="width_cm_positive"),
        CheckConstraint("min_stock IS NULL OR min_stock >= 0", name="min_stock_non_negative"),
    )

    received_at: date
    supplier_name: str = Field(max_length=120)
    paper_type: PaperType = Field(sa_type=PAPER_TYPE)
    width_cm: int = Field(gt=0)
    initial_meters: Decimal = Field(max_digits=10, decimal_places=2)
    current_meters: Decimal = Field(max_digits=10, decimal_places=2)
    # Optional reorder threshold; when set, current at or below it flags low
    # stock (absolute meters floor — overrides the company % default).
    min_stock: Decimal | None = Field(default=None, max_digits=10, decimal_places=2)


class PaperRollMovement(CompanyModel, table=True):
    """Append-only ledger row for a paper roll (history only).

    A single table carries a ``kind`` enum; ENTRY and ADJUSTMENT credit, EXIT
    debits (every row holds a strictly-positive ``quantity``). Unlike the
    counted tiers, on-hand for paper is the roll's ``current_meters`` column —
    this ledger exists purely for traceable history.
    """

    __tablename__ = "paper_roll_movements"
    __table_args__ = (CheckConstraint("quantity > 0", name="quantity_positive"),)

    paper_roll_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("paper_rolls.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    kind: PaperMovementKind = Field(sa_type=PAPER_MOVEMENT_KIND)
    # Metered quantity in meters — Decimal, not int like counted tiers.
    # (``print_order_id`` provenance is deferred to Phase 4 — the
    # ``print_orders`` table does not exist yet.)
    quantity: Decimal = Field(max_digits=12, decimal_places=3)
    notes: str | None = Field(default=None, max_length=500)
