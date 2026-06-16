"""Pydantic schemas for the Prints (estampas) feature."""

import re
import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from models.enums import ArtworkStatus, PrintTechnique
from schemas._common import Page

_HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


class PrintCreate(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=120)
    image_url: str | None = Field(default=None, max_length=512)
    cost_per_unit: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    # Application method + collection tag, surfaced on the estampas page.
    technique: PrintTechnique = PrintTechnique.DTF
    tag: str | None = Field(default=None, max_length=60)
    # Which faces of the garment this estampa is printed on.
    has_front: bool = True
    has_back: bool = False
    # Catalog-level artwork thumbnails + physical size (per-side production PNGs
    # live on the estampa's variations).
    image_url_front: str | None = Field(default=None, max_length=500)
    image_url_back: str | None = Field(default=None, max_length=500)
    width_cm: Decimal | None = Field(default=None, ge=0, max_digits=6, decimal_places=2)
    height_cm: Decimal | None = Field(default=None, ge=0, max_digits=6, decimal_places=2)


class PrintUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=32)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    image_url: str | None = Field(default=None, max_length=512)
    cost_per_unit: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    technique: PrintTechnique | None = None
    tag: str | None = Field(default=None, max_length=60)
    has_front: bool | None = None
    has_back: bool | None = None
    image_url_front: str | None = Field(default=None, max_length=500)
    image_url_back: str | None = Field(default=None, max_length=500)
    width_cm: Decimal | None = Field(default=None, ge=0, max_digits=6, decimal_places=2)
    height_cm: Decimal | None = Field(default=None, ge=0, max_digits=6, decimal_places=2)


class PrintVariationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    ink_hex: str = Field(min_length=7, max_length=7)
    # Files are normally set via the artwork upload endpoint; statuses are
    # server-derived from url presence and never written by the client.
    front_file_url: str | None = Field(default=None, max_length=500)
    back_file_url: str | None = Field(default=None, max_length=500)

    @field_validator("ink_hex")
    @classmethod
    def _validate_ink(cls, value: str) -> str:
        if not _HEX_COLOR_RE.match(value):
            raise ValueError("ink_hex must be a 6-digit hex color like #1f1f1f")
        return value


class PrintVariationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    ink_hex: str | None = Field(default=None, min_length=7, max_length=7)
    front_file_url: str | None = Field(default=None, max_length=500)
    back_file_url: str | None = Field(default=None, max_length=500)

    @field_validator("ink_hex")
    @classmethod
    def _validate_ink(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not _HEX_COLOR_RE.match(value):
            raise ValueError("ink_hex must be a 6-digit hex color like #1f1f1f")
        return value


class PrintVariationRead(BaseModel):
    id: uuid.UUID
    print_design_id: uuid.UUID
    name: str
    ink_hex: str
    front_file_url: str | None = None
    front_status: ArtworkStatus
    back_file_url: str | None = None
    back_status: ArtworkStatus
    created_at: datetime
    updated_at: datetime


class PrintRead(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    code: str
    name: str
    image_url: str | None = None
    cost_per_unit: Decimal
    technique: PrintTechnique
    tag: str | None = None
    has_front: bool
    has_back: bool
    image_url_front: str | None = None
    image_url_back: str | None = None
    width_cm: Decimal | None = None
    height_cm: Decimal | None = None
    variations: list[PrintVariationRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class PrintFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)


PrintPage = Page[PrintRead]
