import uuid

from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import PrintOrder, PrintOrderOutput, PrintOrderStatus, PrintSide


class PrintOrderFactory(ModelFactory[PrintOrder]):
    __model__ = PrintOrder
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    status = PrintOrderStatus.PENDING
    paper_roll_id = None
    printed_at = None
    meters_consumed = None


class PrintOrderOutputFactory(ModelFactory[PrintOrderOutput]):
    __model__ = PrintOrderOutput
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    side = PrintSide.FRONT
    planned_quantity = 10
    printed_quantity = 0


async def create_print_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    print_design_id: uuid.UUID,
    **overrides,
) -> PrintOrder:
    order = PrintOrderFactory.build(company_id=company_id, print_design_id=print_design_id, **overrides)
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def create_print_order_output(
    db: AsyncSession,
    *,
    print_order_id: uuid.UUID,
    print_design_variation_id: uuid.UUID,
    **overrides,
) -> PrintOrderOutput:
    output = PrintOrderOutputFactory.build(
        print_order_id=print_order_id,
        print_design_variation_id=print_design_variation_id,
        **overrides,
    )
    db.add(output)
    await db.commit()
    await db.refresh(output)
    return output
