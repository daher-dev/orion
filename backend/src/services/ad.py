"""Service layer for Ads (anúncios).

An ``Ad`` is an ecommerce listing that sells one or more ``Product``s
(many-to-many via ``ad_products``). Mutations are audited; reads batch-load
each ad's products + spec code so ``AdRead.products`` renders without an
N+1.

Tenant safety
-------------
Every query is scoped to ``company_id``; the product lookups are scoped to the
same tenant so a stale id in a filter can't poison across tenants.

Delete guard
------------
Ads referenced by at least one ``Order`` raise :class:`ConflictError` so we
never orphan sales history. ``ad_products`` rows cascade with the ad.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Ad, AdProduct, Order, Product, ProductSpec
from schemas._common import PageParams
from schemas.ad import AdCreate, AdFilters, AdProductMini, AdUpdate
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError, ValidationError

# A read row: the Ad + the mini-cards of every product it lists.
AdWithProducts = tuple[Ad, list[AdProductMini]]


def _apply_filters(stmt, filters: AdFilters, company_id: uuid.UUID):
    if filters.q:
        needle = f"%{filters.q.lower()}%"
        by_product = (
            select(AdProduct.ad_id)
            .join(Product, Product.id == AdProduct.product_id)
            .where(
                AdProduct.company_id == company_id,
                Product.company_id == company_id,
                func.lower(Product.name).like(needle),
            )
        )
        stmt = stmt.where(
            or_(
                func.lower(Ad.title).like(needle),
                func.lower(Ad.external_id).like(needle),
                Ad.id.in_(by_product),
            )
        )
    if filters.ecommerce is not None:
        stmt = stmt.where(Ad.ecommerce == filters.ecommerce)
    if filters.product_id is not None:
        owners = select(AdProduct.ad_id).where(
            AdProduct.company_id == company_id, AdProduct.product_id == filters.product_id
        )
        stmt = stmt.where(Ad.id.in_(owners))
    return stmt


async def _ensure_products(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    product_ids: list[uuid.UUID],
) -> list[uuid.UUID]:
    """Validate every product id exists for the tenant; return deduped ids (order kept)."""
    ids = list(dict.fromkeys(product_ids))
    found = set((await db.exec(scoped(select(Product.id), Product, company_id).where(Product.id.in_(ids)))).all())
    missing = [pid for pid in ids if pid not in found]
    if missing:
        raise ValidationError(detail="One or more products not found for this company")
    return ids


async def _products_for_ads(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    ad_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[AdProductMini]]:
    out: dict[uuid.UUID, list[AdProductMini]] = {aid: [] for aid in ad_ids}
    if not ad_ids:
        return out
    stmt = (
        select(AdProduct.ad_id, Product.id, Product.name, ProductSpec.code)
        .join(Product, Product.id == AdProduct.product_id)
        .join(ProductSpec, ProductSpec.id == Product.spec_id)
        .where(
            AdProduct.company_id == company_id,
            Product.company_id == company_id,
            AdProduct.ad_id.in_(ad_ids),
        )
        .order_by(Product.name.asc())  # type: ignore[attr-defined]
    )
    for ad_id, pid, name, code in (await db.exec(stmt)).all():
        out.setdefault(ad_id, []).append(AdProductMini(id=pid, name=name, code=code))
    return out


async def _load_with_products(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    ad_id: uuid.UUID,
) -> AdWithProducts:
    ad = (await db.exec(scoped(select(Ad), Ad, company_id).where(Ad.id == ad_id))).first()
    if ad is None:
        raise NotFoundError(detail="Ad not found")
    products = (await _products_for_ads(db, company_id=company_id, ad_ids=[ad.id]))[ad.id]
    return ad, products


# --------------------------------------------------------------------- list


async def list_ads(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: AdFilters | None = None,
    page: PageParams | None = None,
) -> tuple[list[AdWithProducts], int]:
    filters = filters or AdFilters()
    page = page or PageParams()

    count_stmt = _apply_filters(
        select(func.count()).select_from(Ad).where(Ad.company_id == company_id), filters, company_id
    )
    total = int((await db.exec(count_stmt)).one() or 0)

    rows_stmt = (
        _apply_filters(scoped(select(Ad), Ad, company_id), filters, company_id)
        .order_by(Ad.ecommerce.asc(), Ad.created_at.desc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    ads = list((await db.exec(rows_stmt)).all())
    products_by_ad = await _products_for_ads(db, company_id=company_id, ad_ids=[a.id for a in ads])
    return [(a, products_by_ad.get(a.id, [])) for a in ads], total


# ---------------------------------------------------------------------- get


async def get_ad(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    ad_id: uuid.UUID,
) -> AdWithProducts:
    return await _load_with_products(db, company_id=company_id, ad_id=ad_id)


# ------------------------------------------------------------------- create


async def create_ad(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    payload: AdCreate,
) -> AdWithProducts:
    product_ids = await _ensure_products(db, company_id=company_id, product_ids=payload.product_ids)

    ad = Ad(
        company_id=company_id,
        title=payload.title,
        ecommerce=payload.ecommerce,
        external_id=payload.external_id,
    )
    db.add(ad)
    await db.flush()
    for pid in product_ids:
        db.add(AdProduct(company_id=company_id, ad_id=ad.id, product_id=pid))
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="ads",
        resource_id=ad.id,
        message=f"Created ad {ad.title}",
    )
    await db.commit()
    return await _load_with_products(db, company_id=company_id, ad_id=ad.id)


# ------------------------------------------------------------------- update


async def update_ad(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    ad_id: uuid.UUID,
    payload: AdUpdate,
) -> AdWithProducts:
    ad = (await db.exec(scoped(select(Ad), Ad, company_id).where(Ad.id == ad_id))).first()
    if ad is None:
        raise NotFoundError(detail="Ad not found")

    data = payload.model_dump(exclude_unset=True)
    new_product_ids = data.pop("product_ids", None)
    if new_product_ids is not None:
        product_ids = await _ensure_products(db, company_id=company_id, product_ids=new_product_ids)
        existing = (await db.exec(select(AdProduct).where(AdProduct.ad_id == ad.id))).all()
        for link in existing:
            await db.delete(link)
        for pid in product_ids:
            db.add(AdProduct(company_id=company_id, ad_id=ad.id, product_id=pid))

    for field, value in data.items():
        setattr(ad, field, value)

    db.add(ad)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="ads",
        resource_id=ad.id,
        message=f"Updated ad {ad.title}",
    )
    await db.commit()
    return await _load_with_products(db, company_id=company_id, ad_id=ad.id)


# ------------------------------------------------------------------- delete


async def delete_ad(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    ad_id: uuid.UUID,
) -> None:
    stmt = scoped(select(Ad), Ad, company_id).where(Ad.id == ad_id)
    ad = (await db.exec(stmt)).first()
    if ad is None:
        raise NotFoundError(detail="Ad not found")

    linked_orders = await db.exec(select(func.count()).select_from(Order).where(Order.ad_id == ad.id))
    if int(linked_orders.first() or 0) > 0:
        raise ConflictError(detail="Cannot delete ad — orders are linked to it")

    title = ad.title
    await db.delete(ad)  # ad_products cascade
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="ads",
        resource_id=ad_id,
        message=f"Deleted ad {title}",
    )
    await db.commit()


__all__ = [
    "AdWithProducts",
    "create_ad",
    "delete_ad",
    "get_ad",
    "list_ads",
    "update_ad",
]
