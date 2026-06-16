import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import ArtworkStatus, PrintTechnique
from models.pg_enums import ARTWORK_STATUS, PRINT_TECHNIQUE


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

    # Which faces of the garment this estampa is printed on. Drives the
    # per-side artwork tiles in the editor and the printed-transfer keying.
    has_front: bool = Field(default=True)
    has_back: bool = Field(default=False)

    # Print-ready artwork + physical size. ``image_url`` remains the catalog
    # thumbnail; these are the production PNGs / dimensions.
    image_url_front: str | None = Field(default=None, max_length=500)
    image_url_back: str | None = Field(default=None, max_length=500)
    width_cm: Decimal | None = Field(default=None, max_digits=6, decimal_places=2)
    height_cm: Decimal | None = Field(default=None, max_digits=6, decimal_places=2)


class PrintDesignVariation(CompanyModel, table=True):
    """Color variation of an estampa — a recolor with its own per-side artwork.

    Each variation is one ink colour applied to the parent design; it stores the
    actual uploaded PNG (per side) plus a server-derived ok/pending status. The
    status is set from file-url presence on create/update/upload — clients never
    write it directly.
    """

    __tablename__ = "print_design_variations"
    __table_args__ = (CheckConstraint(r"ink_hex ~ '^#[0-9A-Fa-f]{6}$'", name="ink_hex_format"),)

    print_design_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("print_designs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    name: str = Field(max_length=80)
    ink_hex: str = Field(max_length=7)

    front_file_url: str | None = Field(default=None, max_length=500)
    front_status: ArtworkStatus = Field(default=ArtworkStatus.PENDING, sa_type=ARTWORK_STATUS)
    back_file_url: str | None = Field(default=None, max_length=500)
    back_status: ArtworkStatus = Field(default=ArtworkStatus.PENDING, sa_type=ARTWORK_STATUS)
