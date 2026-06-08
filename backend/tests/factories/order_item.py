import uuid

from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import OrderItem, SeparationStatus


class OrderItemFactory(ModelFactory[OrderItem]):
    __model__ = OrderItem
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    status = SeparationStatus.PENDING
    item_index = 0
    total_items = 1


async def create_order_item(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    order_id: uuid.UUID,
    **overrides,
) -> OrderItem:
    item = OrderItemFactory.build(company_id=company_id, order_id=order_id, **overrides)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item
