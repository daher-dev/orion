import uuid

from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import StockEntry, StockExit, StockExitReason, StockSource


class StockEntryFactory(ModelFactory[StockEntry]):
    __model__ = StockEntry
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    quantity = 10
    source = StockSource.ADJUSTMENT
    shipment_id = None


class StockExitFactory(ModelFactory[StockExit]):
    __model__ = StockExit
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    quantity = 1
    reason = StockExitReason.SALE
    order_id = None


async def create_stock_entry(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    variation_id: uuid.UUID,
    **overrides,
) -> StockEntry:
    entry = StockEntryFactory.build(company_id=company_id, variation_id=variation_id, **overrides)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def create_stock_exit(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    variation_id: uuid.UUID,
    **overrides,
) -> StockExit:
    exit_row = StockExitFactory.build(company_id=company_id, variation_id=variation_id, **overrides)
    db.add(exit_row)
    await db.commit()
    await db.refresh(exit_row)
    return exit_row
