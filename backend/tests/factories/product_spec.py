import uuid
from decimal import Decimal

from polyfactory import Use
from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import FabricType, ProductSpec, SpecTrim, TrimType


class ProductSpecFactory(ModelFactory[ProductSpec]):
    __model__ = ProductSpec
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    code = Use(lambda: f"FT{uuid.uuid4().hex[:6].upper()}")
    fabric_type = FabricType.JERSEY
    fabric_grammage_gsm = 180
    fabric_weight_per_piece_g = Decimal("250.00")
    has_ribana = False
    ribana_weight_pct = None
    labor_cost = Decimal("12.00")
    sale_price = Decimal("99.00")


class SpecTrimFactory(ModelFactory[SpecTrim]):
    __model__ = SpecTrim
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    trim_type = TrimType.LABEL
    unit_price = Decimal("0.50")
    quantity = 1


async def create_product_spec(db: AsyncSession, *, company_id: uuid.UUID, **overrides) -> ProductSpec:
    spec = ProductSpecFactory.build(company_id=company_id, **overrides)
    db.add(spec)
    await db.commit()
    await db.refresh(spec)
    return spec


async def create_spec_trim(db: AsyncSession, *, spec_id: uuid.UUID, **overrides) -> SpecTrim:
    trim = SpecTrimFactory.build(spec_id=spec_id, **overrides)
    db.add(trim)
    await db.commit()
    await db.refresh(trim)
    return trim
