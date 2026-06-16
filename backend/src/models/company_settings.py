from typing import Any

from sqlalchemy import Column, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field

from models.base import CompanyModel


class CompanySettings(CompanyModel, table=True):
    """Per-tenant catalog configuration + stock thresholds.

    One row per company holds the whole ``CATALOG_CONFIG_DEFAULTS`` blob
    (product/print color palettes, sizes, fabric/garment types, aviamentos,
    techniques, and the five-tier ``stockThresholds``) as a single JSONB
    document — mirroring the prototype's single ``CatalogConfig`` object. The
    service seeds the default config on first read (read-through default).
    """

    __tablename__ = "company_settings"
    __table_args__ = (UniqueConstraint("company_id", name="uq_company_settings_company_id"),)

    config: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    )
