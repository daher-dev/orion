import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, ForeignKey, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import FabricMovementKind, FabricRollKind, FabricType
from models.pg_enums import FABRIC_MOVEMENT_KIND, FABRIC_ROLL_KIND, FABRIC_TYPE


class FabricRoll(CompanyModel, table=True):
    """Bobina — raw fabric roll received from a supplier."""

    __tablename__ = "fabric_rolls"
    __table_args__ = (
        CheckConstraint("initial_weight_kg > 0", name="initial_weight_positive"),
        CheckConstraint("current_weight_kg >= 0", name="current_weight_non_negative"),
        CheckConstraint("price_per_kg >= 0", name="price_per_kg_non_negative"),
    )

    received_at: date
    supplier_name: str = Field(max_length=120)
    kind: FabricRollKind = Field(sa_type=FABRIC_ROLL_KIND)
    fabric_type: FabricType = Field(sa_type=FABRIC_TYPE)
    initial_weight_kg: Decimal = Field(max_digits=10, decimal_places=3)
    current_weight_kg: Decimal = Field(max_digits=10, decimal_places=3)
    color: str = Field(max_length=40)
    price_per_kg: Decimal = Field(max_digits=10, decimal_places=2)


class FabricRollMovement(CompanyModel, table=True):
    """Append-only ledger row for a fabric roll (history only).

    A single table carries a ``kind`` enum; ENTRY and ADJUSTMENT credit, EXIT
    debits (every row holds a strictly-positive ``quantity`` in kg). Unlike the
    counted tiers, on-hand for fabric is the roll's ``current_weight_kg`` column
    — this ledger exists purely for traceable history. Mirrors
    ``PaperRollMovement``.
    """

    __tablename__ = "fabric_roll_movements"
    __table_args__ = (CheckConstraint("quantity > 0", name="quantity_positive"),)

    fabric_roll_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("fabric_rolls.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    kind: FabricMovementKind = Field(sa_type=FABRIC_MOVEMENT_KIND)
    # Metered quantity in kg — Decimal, not int like counted tiers.
    quantity: Decimal = Field(max_digits=12, decimal_places=3)
    # Provenance: an EXIT debiting fabric may originate from a cutting order
    # reaching DONE (T1). Set only by the cutting-DONE transition (Phase 3),
    # null on manual movements.
    cutting_order_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("cutting_orders.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    notes: str | None = Field(default=None, max_length=500)
