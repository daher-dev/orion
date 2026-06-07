from decimal import Decimal

from sqlalchemy import UniqueConstraint
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import PrintTechnique
from models.pg_enums import PRINT_TECHNIQUE


class PrintDesign(CompanyModel, table=True):
    """Estampa — the artwork applied to a product."""

    __tablename__ = "print_designs"
    __table_args__ = (UniqueConstraint("company_id", "code", name="uq_print_designs_company_id_code"),)

    code: str = Field(max_length=20)
    name: str = Field(max_length=120)
    image_url: str | None = Field(default=None, max_length=500)
    cost_per_unit: Decimal = Field(max_digits=12, decimal_places=2)

    # Application method (DTF / silkscreen / sublimation) and an optional
    # collection/season tag — surfaced on the estampas catalog page.
    technique: PrintTechnique = Field(default=PrintTechnique.DTF, sa_type=PRINT_TECHNIQUE)
    tag: str | None = Field(default=None, max_length=60)

    # Print-ready artwork + physical size sent to the Montador DTF assembler.
    # ``image_url`` remains the catalog thumbnail; these are the production PNGs.
    image_url_front: str | None = Field(default=None, max_length=500)
    image_url_back: str | None = Field(default=None, max_length=500)
    width_cm: Decimal | None = Field(default=None, max_digits=6, decimal_places=2)
    height_cm: Decimal | None = Field(default=None, max_digits=6, decimal_places=2)
