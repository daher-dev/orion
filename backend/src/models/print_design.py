from decimal import Decimal

from sqlalchemy import UniqueConstraint
from sqlmodel import Field

from models.base import CompanyModel


class PrintDesign(CompanyModel, table=True):
    """Estampa — the artwork applied to a product."""

    __tablename__ = "print_designs"
    __table_args__ = (UniqueConstraint("company_id", "code", name="uq_print_designs_company_id_code"),)

    code: str = Field(max_length=20)
    name: str = Field(max_length=120)
    image_url: str | None = Field(default=None, max_length=500)
    cost_per_unit: Decimal = Field(max_digits=12, decimal_places=2)
