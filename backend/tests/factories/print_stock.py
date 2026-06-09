import uuid

from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import PrintStockDirection, PrintStockMovement


class PrintStockMovementFactory(ModelFactory[PrintStockMovement]):
    __model__ = PrintStockMovement
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    quantity = 10
    direction = PrintStockDirection.ENTRY
    product_color = "Preto"
    batch_id = None


async def create_print_stock_movement(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    print_design_id: uuid.UUID,
    **overrides,
) -> PrintStockMovement:
    movement = PrintStockMovementFactory.build(
        company_id=company_id,
        print_design_id=print_design_id,
        **overrides,
    )
    db.add(movement)
    await db.commit()
    await db.refresh(movement)
    return movement
