"""Pydantic schemas for per-company catalog configuration + stock thresholds.

The whole ``config`` blob is a single validated document (the prototype's
``CatalogConfig``). It is full-replaced on ``PUT`` — clients send the entire
``CompanySettingsConfig`` back, not a patch. ``GET`` never 404s: the service
returns ``DEFAULT_CONFIG`` (create-on-read) for a tenant with no row yet.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator, model_validator

_HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
_SKU_PREFIX_RE = re.compile(r"^[A-Z0-9]{1,4}$")
_COLOR_CODE_RE = re.compile(r"^[A-Z]{3}$")

# Allowed measurement units per stock tier. fabric is weight (kg) or a percent
# of the initial balance; paper is meters (m) or percent; the counted tiers
# (blank/printed/product) are whole pieces (qty).
_ALLOWED_UNITS: dict[str, frozenset[str]] = {
    "fabric": frozenset({"pct", "kg"}),
    "paper": frozenset({"pct", "m"}),
    "blank": frozenset({"qty"}),
    "printed": frozenset({"qty"}),
    "product": frozenset({"qty"}),
}


class ColorEntry(BaseModel):
    hex: str
    name: str = Field(min_length=1, max_length=60)
    # 3-uppercase-letter SKU token. Required for productColors (the fabric palette
    # that drives variation SKUs); unused/optional for printColors (keyed by hex).
    code: str | None = None

    @field_validator("hex")
    @classmethod
    def _validate_hex(cls, value: str) -> str:
        if not _HEX_COLOR_RE.match(value):
            raise ValueError("hex must be a 6-digit hex color like #1f1f1f")
        return value

    @field_validator("code")
    @classmethod
    def _validate_code(cls, value: str | None) -> str | None:
        if value is not None and not _COLOR_CODE_RE.match(value):
            raise ValueError("code must be three uppercase letters")
        return value


class GarmentTypeEntry(BaseModel):
    # Field names mirror the camelCase wire contract (CATALOG_CONFIG_DEFAULTS).
    id: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=60)
    skuPrefix: str = Field(min_length=1, max_length=4)  # noqa: N815 — wire shape
    icon: str = Field(min_length=1, max_length=40)

    @field_validator("skuPrefix")
    @classmethod
    def _validate_prefix(cls, value: str) -> str:
        if not _SKU_PREFIX_RE.match(value):
            raise ValueError("skuPrefix must be 1-4 uppercase letters/digits")
        return value


class StockThreshold(BaseModel):
    enabled: bool = True
    unit: str
    value: float = Field(ge=0)


class StockThresholds(BaseModel):
    fabric: StockThreshold
    paper: StockThreshold
    blank: StockThreshold
    printed: StockThreshold
    product: StockThreshold

    @model_validator(mode="after")
    def _validate_units(self) -> StockThresholds:
        for tier, allowed in _ALLOWED_UNITS.items():
            threshold: StockThreshold = getattr(self, tier)
            if threshold.unit not in allowed:
                raise ValueError(
                    f"stockThresholds.{tier}.unit must be one of {sorted(allowed)}, got {threshold.unit!r}"
                )
        return self


def _non_empty_strings(values: list[str]) -> list[str]:
    for item in values:
        if not item or not item.strip():
            raise ValueError("entries must be non-empty strings")
    return values


class CompanySettingsConfig(BaseModel):
    # Field names mirror the camelCase wire contract (CATALOG_CONFIG_DEFAULTS).
    productColors: list[ColorEntry]  # noqa: N815 — wire shape
    printColors: list[ColorEntry]  # noqa: N815 — wire shape
    sizes: list[str]
    fabricTypes: list[str]  # noqa: N815 — wire shape
    garmentTypes: list[GarmentTypeEntry]  # noqa: N815 — wire shape
    aviamentos: list[str]
    techniques: list[str]
    stockThresholds: StockThresholds  # noqa: N815 — wire shape

    @field_validator("sizes", "fabricTypes", "aviamentos", "techniques")
    @classmethod
    def _validate_string_lists(cls, value: list[str]) -> list[str]:
        return _non_empty_strings(value)

    @model_validator(mode="after")
    def _validate_product_colors(self) -> CompanySettingsConfig:
        # The fabric palette is the source of truth for product variation colors:
        # every entry must carry a unique 3-letter code (it drives the SKU) and a
        # unique name. printColors (keyed by hex) are exempt.
        seen_codes: set[str] = set()
        seen_names: set[str] = set()
        for entry in self.productColors:
            if not entry.code:
                raise ValueError(f"productColors entry {entry.name!r} is missing a code")
            if entry.code in seen_codes:
                raise ValueError(f"duplicate productColors code {entry.code!r}")
            name_key = entry.name.strip().casefold()
            if name_key in seen_names:
                raise ValueError(f"duplicate productColors name {entry.name!r}")
            seen_codes.add(entry.code)
            seen_names.add(name_key)
        return self


class CompanySettingsRead(BaseModel):
    config: CompanySettingsConfig


class CompanySettingsUpdate(BaseModel):
    config: CompanySettingsConfig


__all__ = [
    "ColorEntry",
    "CompanySettingsConfig",
    "CompanySettingsRead",
    "CompanySettingsUpdate",
    "GarmentTypeEntry",
    "StockThreshold",
    "StockThresholds",
]
