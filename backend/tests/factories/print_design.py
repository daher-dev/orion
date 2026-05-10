import uuid
from decimal import Decimal

from polyfactory import Use
from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import PrintDesign


class PrintDesignFactory(ModelFactory[PrintDesign]):
    __model__ = PrintDesign
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    code = Use(lambda: f"PD{uuid.uuid4().hex[:6].upper()}")
    cost_per_unit = Decimal("3.50")


async def create_print_design(db: AsyncSession, *, company_id: uuid.UUID, **overrides) -> PrintDesign:
    design = PrintDesignFactory.build(company_id=company_id, **overrides)
    db.add(design)
    await db.commit()
    await db.refresh(design)
    return design
