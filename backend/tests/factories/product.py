import uuid

from polyfactory import Use
from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Product, ProductType, ProductVariation, Size


class ProductFactory(ModelFactory[Product]):
    __model__ = Product
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    product_type = ProductType.TSHIRT
    print_id = None


class ProductVariationFactory(ModelFactory[ProductVariation]):
    __model__ = ProductVariation
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    size = Size.M
    color = "Preto"
    color_code = "BLK"
    sku = Use(lambda: f"SKU-{uuid.uuid4().hex[:8].upper()}")


async def create_product(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    spec_id: uuid.UUID,
    **overrides,
) -> Product:
    product = ProductFactory.build(company_id=company_id, spec_id=spec_id, **overrides)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def create_product_variation(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    product_id: uuid.UUID,
    **overrides,
) -> ProductVariation:
    variation = ProductVariationFactory.build(company_id=company_id, product_id=product_id, **overrides)
    db.add(variation)
    await db.commit()
    await db.refresh(variation)
    return variation
