import uuid

from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Ad, AdProduct, Ecommerce


class AdFactory(ModelFactory[Ad]):
    __model__ = Ad
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    ecommerce = Ecommerce.SHOPEE


async def create_ad(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    product_ids: list[uuid.UUID] | None = None,
    product_id: uuid.UUID | None = None,
    **overrides,
) -> Ad:
    """Create an Ad linked to one or more products (via ``ad_products``).

    Accepts either ``product_ids`` (the M:N set) or the legacy ``product_id``
    convenience (wrapped to a single-element set).
    """
    ids = list(product_ids) if product_ids else ([product_id] if product_id is not None else [])
    ad = AdFactory.build(company_id=company_id, **overrides)
    db.add(ad)
    await db.flush()
    for pid in ids:
        db.add(AdProduct(company_id=company_id, ad_id=ad.id, product_id=pid))
    await db.commit()
    await db.refresh(ad)
    return ad
