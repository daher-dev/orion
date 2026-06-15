import uuid

from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import CuttingOrder, CuttingOrderOutput, CuttingStatus, Size


class CuttingOrderFactory(ModelFactory[CuttingOrder]):
    __model__ = CuttingOrder
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    status = CuttingStatus.PENDING
    cut_at = None
    color = "Preto"
    color_code = "PRT"
    rib_roll_id = None


class CuttingOrderOutputFactory(ModelFactory[CuttingOrderOutput]):
    __model__ = CuttingOrderOutput
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    size = Size.M
    quantity = 10


async def create_cutting_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    spec_id: uuid.UUID,
    body_roll_id: uuid.UUID,
    **overrides,
) -> CuttingOrder:
    order = CuttingOrderFactory.build(
        company_id=company_id,
        spec_id=spec_id,
        body_roll_id=body_roll_id,
        **overrides,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def create_cutting_order_output(
    db: AsyncSession,
    *,
    cutting_order_id: uuid.UUID,
    **overrides,
) -> CuttingOrderOutput:
    output = CuttingOrderOutputFactory.build(cutting_order_id=cutting_order_id, **overrides)
    db.add(output)
    await db.commit()
    await db.refresh(output)
    return output
