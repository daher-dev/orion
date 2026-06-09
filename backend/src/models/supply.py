import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, ForeignKey, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import SupplyMovementKind
from models.pg_enums import SUPPLY_MOVEMENT_KIND


class Supply(CompanyModel, table=True):
    """Insumo — a consumable supply tracked in the catalog.

    The on-hand quantity is NOT stored here; it is derived live from the
    append-only ``supply_movements`` ledger (see ``services.supply``), mirroring
    the finished-piece Stock feature.
    """

    __tablename__ = "supplies"
    __table_args__ = (
        CheckConstraint("unit_cost >= 0", name="unit_cost_non_negative"),
        CheckConstraint("min_stock IS NULL OR min_stock >= 0", name="min_stock_non_negative"),
    )

    name: str = Field(max_length=120)
    unit: str = Field(max_length=20)
    unit_cost: Decimal = Field(max_digits=10, decimal_places=2)
    # Optional reorder threshold; when set, on-hand at or below it flags low stock.
    min_stock: Decimal | None = Field(default=None, max_digits=12, decimal_places=3)
    notes: str | None = Field(default=None, max_length=500)


class SupplyMovement(CompanyModel, table=True):
    """Append-only ledger row for a supply.

    A single table carries a ``kind`` enum; ENTRY and ADJUSTMENT credit stock,
    EXIT debits it (every row holds a strictly-positive ``quantity``). On-hand
    is the signed sum of these rows per supply — no materialised balance column.
    """

    __tablename__ = "supply_movements"
    __table_args__ = (CheckConstraint("quantity > 0", name="quantity_positive"),)

    supply_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("supplies.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    kind: SupplyMovementKind = Field(sa_type=SUPPLY_MOVEMENT_KIND)
    # Fractional units (m, kg, L) — Decimal, not int like finished-piece stock.
    quantity: Decimal = Field(max_digits=12, decimal_places=3)
    notes: str | None = Field(default=None, max_length=500)
