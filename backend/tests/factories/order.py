import uuid
from datetime import UTC, datetime
from decimal import Decimal

from polyfactory import Use
from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Order, OrderStatus


class OrderFactory(ModelFactory[Order]):
    __model__ = Order
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    quantity = 1
    sale_price = Decimal("99.00")
    status = OrderStatus.PENDING
    ordered_at = Use(lambda: datetime.now(UTC))


async def create_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    ad_id: uuid.UUID,
    variation_id: uuid.UUID,
    client_id: uuid.UUID,
    **overrides,
) -> Order:
    order = OrderFactory.build(
        company_id=company_id,
        ad_id=ad_id,
        variation_id=variation_id,
        client_id=client_id,
        **overrides,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order
