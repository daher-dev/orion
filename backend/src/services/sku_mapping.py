"""Service layer for the marketplace SKU De/Para (``SkuMapping``).

Persists an operator's resolution of an unmatched import line —
``(marketplace, sku) → (ad_id, variation_id)`` — which the Upseller importer
then consults SKU-first (see :mod:`services.imported_orders`). Once a SKU is
mapped it resolves deterministically on every later import, so the unmatched
queue is a one-time cost per marketplace SKU rather than a per-import chore.

The write enforces the same invariant as the De/Para item mapping
(:func:`services.mapping._assign_variation`): the variation's product must
belong to one of the ad's products, so a mapping can never decrement stock for
a product the listing doesn't sell.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Ad, AdProduct, Product, ProductVariation, SkuMapping
from models.enums import Ecommerce
from schemas.sku_mapping import SkuMappingPage, SkuMappingRead
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import NotFoundError, ValidationError

_RESOURCE = "orders"


def _normalize_sku(sku: str) -> str:
    normalized = (sku or "").strip().lower()
    if not normalized:
        raise ValidationError(detail="SKU is required")
    return normalized


async def _ad_product_ids(db: AsyncSession, *, company_id: uuid.UUID, ad_id: uuid.UUID) -> set[uuid.UUID]:
    return set(
        (
            await db.exec(
                select(AdProduct.product_id).where(AdProduct.ad_id == ad_id, AdProduct.company_id == company_id)
            )
        ).all()
    )


async def _to_read(db: AsyncSession, *, company_id: uuid.UUID, mapping: SkuMapping) -> SkuMappingRead:
    """Enrich a stored row with ad title + variation/product context."""

    ad = (await db.exec(scoped(select(Ad), Ad, company_id).where(Ad.id == mapping.ad_id))).first()
    variation = (
        await db.exec(
            scoped(select(ProductVariation), ProductVariation, company_id).where(
                ProductVariation.id == mapping.variation_id
            )
        )
    ).first()
    product = None
    if variation is not None:
        product = (
            await db.exec(
                scoped(select(Product), Product, company_id).where(Product.id == variation.product_id)
            )
        ).first()
    return SkuMappingRead(
        id=mapping.id,
        marketplace=mapping.marketplace,
        sku=mapping.sku,
        ad_id=mapping.ad_id,
        variation_id=mapping.variation_id,
        source=mapping.source,
        created_at=mapping.created_at,
        ad_title=ad.title if ad else None,
        product_name=product.name if product else None,
        variation_sku=variation.sku if variation else None,
        color=variation.color if variation else None,
        size=variation.size if variation else None,
    )


async def upsert_mapping(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    marketplace: Ecommerce,
    sku: str,
    ad_id: uuid.UUID,
    variation_id: uuid.UUID,
) -> SkuMappingRead:
    """Create or overwrite the De/Para entry for ``(marketplace, sku)``."""

    sku_norm = _normalize_sku(sku)

    ad = (await db.exec(scoped(select(Ad), Ad, company_id).where(Ad.id == ad_id))).first()
    if ad is None:
        raise NotFoundError(detail="Ad not found for this company")

    variation = (
        await db.exec(
            scoped(select(ProductVariation), ProductVariation, company_id).where(ProductVariation.id == variation_id)
        )
    ).first()
    if variation is None:
        raise ValidationError(detail="Variation not found for this company")

    if variation.product_id not in await _ad_product_ids(db, company_id=company_id, ad_id=ad_id):
        raise ValidationError(detail="Variation does not belong to any of the ad's products")

    existing = (
        await db.exec(
            scoped(select(SkuMapping), SkuMapping, company_id).where(
                SkuMapping.marketplace == marketplace, SkuMapping.sku == sku_norm
            )
        )
    ).first()

    if existing is not None:
        existing.ad_id = ad_id
        existing.variation_id = variation_id
        existing.source = "manual"
        existing.created_by = user_id
        db.add(existing)
        mapping = existing
    else:
        mapping = SkuMapping(
            company_id=company_id,
            marketplace=marketplace,
            sku=sku_norm,
            ad_id=ad_id,
            variation_id=variation_id,
            source="manual",
            created_by=user_id,
        )
        db.add(mapping)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=mapping.id,
        message=f"Mapped {marketplace.value} SKU {sku_norm} → variation {variation.sku}",
    )
    await db.commit()
    await db.refresh(mapping)
    return await _to_read(db, company_id=company_id, mapping=mapping)


async def list_mappings(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    page: int = 1,
    page_size: int = 50,
) -> SkuMappingPage:
    """List stored De/Para entries (newest first)."""

    total = int(
        (await db.exec(scoped(select(func.count()).select_from(SkuMapping), SkuMapping, company_id))).one() or 0
    )
    rows = (
        await db.exec(
            scoped(select(SkuMapping), SkuMapping, company_id)
            .order_by(SkuMapping.created_at.desc())  # type: ignore[attr-defined]
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    items = [await _to_read(db, company_id=company_id, mapping=row) for row in rows]
    return SkuMappingPage(items=items, total=total)


async def delete_mapping(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    mapping_id: uuid.UUID,
) -> None:
    """Forget a De/Para entry — the SKU falls back to fuzzy matching again."""

    mapping = (
        await db.exec(scoped(select(SkuMapping), SkuMapping, company_id).where(SkuMapping.id == mapping_id))
    ).first()
    if mapping is None:
        raise NotFoundError(detail="SKU mapping not found")
    await db.delete(mapping)
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=mapping_id,
        message=f"Removed SKU mapping {mapping.marketplace.value}/{mapping.sku}",
    )
    await db.commit()


__all__ = [
    "delete_mapping",
    "list_mappings",
    "upsert_mapping",
]
