"""Service layer for Ads (anúncios).

An ``Ad`` links a ``Product`` to an ecommerce channel. Mutations are
audited; reads eager-load the product + its spec so the AdRead can
expose `product.code` (the spec code, e.g. ``FT-014``) without a
second round-trip.

Tenant safety
-------------
Every query is scoped to ``company_id`` on the ``Ad`` table; the
product join is also scoped to the same tenant to make cross-tenant
poisoning impossible even if a stale id is passed in a filter.

Delete guard
------------
Ads referenced by at least one ``Order`` raise :class:`ConflictError`
so we never orphan sales history.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Ad, Order, Product, ProductSpec
from schemas._common import PageParams
from schemas.ad import AdCreate, AdFilters, AdUpdate
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError, ValidationError

# A single read row: the Ad + its Product + the spec code. We return a
# tuple instead of stuffing it onto the SQLModel instance to keep the
# Ad table object plain.
AdWithProduct = tuple[Ad, Product, str]


def _apply_filters(stmt, filters: AdFilters):
    if filters.q:
        needle = f"%{filters.q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Ad.title).like(needle),
                func.lower(Ad.external_id).like(needle),
                func.lower(Product.name).like(needle),
            )
        )
    if filters.ecommerce is not None:
        stmt = stmt.where(Ad.ecommerce == filters.ecommerce)
    if filters.product_id is not None:
        stmt = stmt.where(Ad.product_id == filters.product_id)
    return stmt


async def _ensure_product(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    product_id: uuid.UUID,
) -> Product:
    stmt = scoped(select(Product), Product, company_id).where(Product.id == product_id)
    product = (await db.exec(stmt)).first()
    if product is None:
        raise ValidationError(detail="Product not found for this company")
    return product


async def _load_with_product(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    ad_id: uuid.UUID,
) -> AdWithProduct:
    """Fetch one ad joined with its product + spec.code, scoped to tenant."""

    stmt = (
        select(Ad, Product, ProductSpec.code)
        .join(Product, Product.id == Ad.product_id)
        .join(ProductSpec, ProductSpec.id == Product.spec_id)
        .where(Ad.company_id == company_id, Ad.id == ad_id)
    )
    row = (await db.exec(stmt)).first()
    if row is None:
        raise NotFoundError(detail="Ad not found")
    return row  # type: ignore[return-value]


# --------------------------------------------------------------------- list


async def list_ads(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: AdFilters | None = None,
    page: PageParams | None = None,
) -> tuple[list[AdWithProduct], int]:
    filters = filters or AdFilters()
    page = page or PageParams()

    base = (
        select(Ad, Product, ProductSpec.code)
        .join(Product, Product.id == Ad.product_id)
        .join(ProductSpec, ProductSpec.id == Product.spec_id)
        .where(Ad.company_id == company_id)
    )
    base = _apply_filters(base, filters)

    count_stmt = (
        select(func.count())
        .select_from(Ad)
        .join(Product, Product.id == Ad.product_id)
        .where(Ad.company_id == company_id)
    )
    count_stmt = _apply_filters(count_stmt, filters)
    total = int((await db.exec(count_stmt)).one() or 0)

    rows_stmt = (
        base.order_by(Ad.ecommerce.asc(), Ad.created_at.desc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    rows = list((await db.exec(rows_stmt)).all())
    return rows, total  # type: ignore[return-value]


# ---------------------------------------------------------------------- get


async def get_ad(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    ad_id: uuid.UUID,
) -> AdWithProduct:
    return await _load_with_product(db, company_id=company_id, ad_id=ad_id)


# ------------------------------------------------------------------- create


async def create_ad(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    payload: AdCreate,
) -> AdWithProduct:
    await _ensure_product(db, company_id=company_id, product_id=payload.product_id)

    ad = Ad(
        company_id=company_id,
        title=payload.title,
        ecommerce=payload.ecommerce,
        external_id=payload.external_id,
        product_id=payload.product_id,
    )
    db.add(ad)
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
    await db.refresh(ad)
    return await _load_with_product(db, company_id=company_id, ad_id=ad.id)


# ------------------------------------------------------------------- update


async def update_ad(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    ad_id: uuid.UUID,
    payload: AdUpdate,
) -> AdWithProduct:
    stmt = scoped(select(Ad), Ad, company_id).where(Ad.id == ad_id)
    ad = (await db.exec(stmt)).first()
    if ad is None:
        raise NotFoundError(detail="Ad not found")

    data = payload.model_dump(exclude_unset=True)
    if "product_id" in data and data["product_id"] is not None:
        await _ensure_product(db, company_id=company_id, product_id=data["product_id"])

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
    await db.refresh(ad)
    return await _load_with_product(db, company_id=company_id, ad_id=ad.id)


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
    await db.delete(ad)
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
    "AdWithProduct",
    "create_ad",
    "delete_ad",
    "get_ad",
    "list_ads",
    "update_ad",
]
