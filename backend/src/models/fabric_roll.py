from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import FabricRollKind, FabricType
from models.pg_enums import FABRIC_ROLL_KIND, FABRIC_TYPE


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
