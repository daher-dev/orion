import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field

from models.base import BaseModel, CompanyModel
from models.enums import FabricType, TrimType
from models.pg_enums import FABRIC_TYPE, TRIM_TYPE


class ProductSpec(CompanyModel, table=True):
    """Ficha técnica — production recipe for a product."""

    __tablename__ = "product_specs"
    __table_args__ = (
        UniqueConstraint("company_id", "code", name="uq_product_specs_company_id_code"),
        CheckConstraint(
            "(has_ribana = false AND ribana_weight_pct IS NULL)"
            " OR (has_ribana = true AND ribana_weight_pct IS NOT NULL)",
            name="ribana_pct_iff_has_ribana",
        ),
        CheckConstraint(
            "ribana_weight_pct IS NULL OR (ribana_weight_pct > 0 AND ribana_weight_pct <= 100)",
            name="ribana_weight_pct_range",
        ),
    )

    code: str = Field(max_length=20)
    name: str = Field(max_length=120)

    fabric_type: FabricType = Field(sa_type=FABRIC_TYPE)
    fabric_grammage_gsm: int = Field(gt=0)
    fabric_weight_per_piece_g: Decimal = Field(max_digits=8, decimal_places=2, gt=0)

    has_ribana: bool = Field(default=False)
    ribana_weight_pct: Decimal | None = Field(default=None, max_digits=5, decimal_places=2)

    labor_cost: Decimal = Field(max_digits=12, decimal_places=2, ge=0)
    sale_price: Decimal = Field(max_digits=12, decimal_places=2, ge=0)
    notes: str | None = Field(default=None)


class SpecTrim(BaseModel, table=True):
    """Aviamento — a trim/notion (button, zipper, etc.) used by a spec."""

    __tablename__ = "spec_trims"

    spec_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("product_specs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    trim_type: TrimType = Field(sa_type=TRIM_TYPE)
    unit_price: Decimal = Field(max_digits=12, decimal_places=2, ge=0)
    quantity: int = Field(default=1, gt=0)
