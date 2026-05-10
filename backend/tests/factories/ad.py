import uuid

from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Ad, Ecommerce


class AdFactory(ModelFactory[Ad]):
    __model__ = Ad
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    ecommerce = Ecommerce.SHOPEE


async def create_ad(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    product_id: uuid.UUID,
    **overrides,
) -> Ad:
    ad = AdFactory.build(company_id=company_id, product_id=product_id, **overrides)
    db.add(ad)
    await db.commit()
    await db.refresh(ad)
    return ad
