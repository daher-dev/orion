"""Service layer for per-company catalog configuration + stock thresholds.

One ``CompanySettings`` row per tenant holds the whole ``CATALOG_CONFIG_DEFAULTS``
blob as JSONB. Reads are read-through: a tenant with no row yet gets the row
created on first read seeded with :data:`DEFAULT_CONFIG` (so the UI always has a
config and never 404s). Stored config is shallow-merged *over* the defaults so
keys added in a newer version of the default appear for existing tenants without
a migration. Writes full-replace the ``config`` document.
"""

from __future__ import annotations

import copy
import uuid
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import CompanySettings
from services._audit import write_audit
from services._base import scoped

# Canonical default config, ported from docs/design/data.js CATALOG_CONFIG_DEFAULTS.
DEFAULT_CONFIG: dict[str, Any] = {
    "productColors": [
        {"hex": "#1f1f1f", "name": "Preto", "code": "PRT"},
        {"hex": "#f4f1ea", "name": "Off-white", "code": "OFF"},
        {"hex": "#7a4b2a", "name": "Marrom", "code": "MAR"},
        {"hex": "#c9b9a3", "name": "Areia", "code": "ARE"},
        {"hex": "#cfb98e", "name": "Bege", "code": "BEG"},
        {"hex": "#7a8a76", "name": "Verde-musgo", "code": "MUS"},
        {"hex": "#3a4a3d", "name": "Verde escuro", "code": "VES"},
        {"hex": "#6b4a2e", "name": "Caramelo", "code": "CAR"},
        {"hex": "#b03a2e", "name": "Vermelho", "code": "VRM"},
        {"hex": "#2a3b5a", "name": "Azul-marinho", "code": "AZM"},
    ],
    "printColors": [
        {"hex": "#f4f1ea", "name": "Branco"},
        {"hex": "#1f1f1f", "name": "Preto"},
        {"hex": "#efe6d3", "name": "Off-white"},
        {"hex": "#b03a2e", "name": "Vermelho"},
        {"hex": "#3a4a3d", "name": "Verde escuro"},
        {"hex": "#cfb98e", "name": "Bege"},
        {"hex": "#2a3b5a", "name": "Azul-marinho"},
    ],
    "sizes": ["P", "M", "G", "GG", "U"],
    "fabricTypes": [
        "Algodão 30.1",
        "Algodão 24.1 penteado",
        "Malha PV (67/33)",
        "Malha 100% poliéster",
        "Moletom flanelado",
        "Sarja crua",
        "Linho misto",
        "Piquet algodão",
    ],
    "garmentTypes": [
        {"id": "camiseta", "label": "Camiseta", "skuPrefix": "CAM", "icon": "camiseta"},
        {"id": "moletom", "label": "Moletom", "skuPrefix": "MOL", "icon": "moletom"},
        {"id": "regata", "label": "Regata", "skuPrefix": "REG", "icon": "regata"},
        {"id": "blusa", "label": "Blusa", "skuPrefix": "BLU", "icon": "blusa"},
        {"id": "calca", "label": "Calça", "skuPrefix": "CAL", "icon": "calca"},
        {"id": "bermuda", "label": "Bermuda", "skuPrefix": "BER", "icon": "bermuda"},
    ],
    "aviamentos": [
        "Etiqueta interna tecida",
        "Etiqueta de composição",
        "Etiqueta externa estampada",
        "Tag de papel",
        "Lacre/sigilo",
        "Cordão capuz",
        "Zíper",
        "Botão",
        "Cadarço",
        "Elástico",
    ],
    "techniques": ["DTF", "Silkscreen", "Sublimação"],
    "stockThresholds": {
        "fabric": {"enabled": True, "unit": "pct", "value": 25},
        "paper": {"enabled": True, "unit": "pct", "value": 25},
        "blank": {"enabled": True, "unit": "qty", "value": 20},
        "printed": {"enabled": True, "unit": "qty", "value": 10},
        "product": {"enabled": True, "unit": "qty", "value": 10},
    },
}


def default_config() -> dict[str, Any]:
    """A fresh deep copy of the default config (callers may mutate it)."""

    return copy.deepcopy(DEFAULT_CONFIG)


def _merged_config(stored: dict[str, Any] | None) -> dict[str, Any]:
    """Stored config shallow-merged over the defaults (stored wins per top-level key)."""

    merged = default_config()
    if stored:
        merged.update(stored)
    return merged


async def _fetch(db: AsyncSession, *, company_id: uuid.UUID) -> CompanySettings | None:
    stmt = scoped(select(CompanySettings), CompanySettings, company_id)
    return (await db.exec(stmt)).first()


async def get_settings(db: AsyncSession, *, company_id: uuid.UUID) -> CompanySettings:
    """Return the tenant's settings, creating the row with defaults on first read.

    The returned row's ``config`` is the stored config merged over the defaults
    so newly-added default keys surface without a migration.
    """

    settings = await _fetch(db, company_id=company_id)
    if settings is None:
        settings = CompanySettings(company_id=company_id, config=default_config())
        db.add(settings)
        try:
            await db.commit()
        except IntegrityError:
            # A concurrent read created the row first — fall back to it.
            await db.rollback()
            settings = await _fetch(db, company_id=company_id)
            if settings is None:  # pragma: no cover - defensive
                raise
        else:
            await db.refresh(settings)

    settings.config = _merged_config(settings.config)
    return settings


async def update_settings(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    config: dict[str, Any],
) -> CompanySettings:
    """Upsert the single settings row, full-replacing ``config``."""

    settings = await _fetch(db, company_id=company_id)
    if settings is None:
        settings = CompanySettings(company_id=company_id, config=config)
        db.add(settings)
    else:
        settings.config = config
        db.add(settings)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="companies",
        resource_id=settings.id,
        message="Updated company settings",
    )
    await db.commit()
    await db.refresh(settings)
    return settings


async def product_color_index(db: AsyncSession, *, company_id: uuid.UUID) -> dict[str, dict[str, Any]]:
    """Return the tenant's fabric palette keyed by 3-letter ``code``.

    Used by the product service to enforce that a variation's ``color_code``
    references a registered palette entry (the source of truth) and to take the
    canonical color name from it. Falls back to defaults via :func:`get_settings`.
    """

    settings = await get_settings(db, company_id=company_id)
    palette = settings.config.get("productColors") or []
    return {entry["code"]: entry for entry in palette if entry.get("code")}


__all__ = [
    "DEFAULT_CONFIG",
    "default_config",
    "get_settings",
    "product_color_index",
    "update_settings",
]
