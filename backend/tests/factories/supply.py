import uuid
from decimal import Decimal

from polyfactory import Use
from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Supply, SupplyMovement, SupplyMovementKind


class SupplyFactory(ModelFactory[Supply]):
    __model__ = Supply
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    name = Use(lambda: f"Insumo {uuid.uuid4().hex[:6]}")
    unit = "m"
    unit_cost = Decimal("12.50")
    min_stock = None
    notes = None


class SupplyMovementFactory(ModelFactory[SupplyMovement]):
    __model__ = SupplyMovement
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    kind = SupplyMovementKind.ENTRY
    quantity = Decimal("10.000")
    notes = None


async def create_supply(db: AsyncSession, *, company_id: uuid.UUID, **overrides) -> Supply:
    supply = SupplyFactory.build(company_id=company_id, **overrides)
    db.add(supply)
    await db.commit()
    await db.refresh(supply)
    return supply


async def create_supply_movement(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    supply_id: uuid.UUID,
    **overrides,
) -> SupplyMovement:
    movement = SupplyMovementFactory.build(company_id=company_id, supply_id=supply_id, **overrides)
    db.add(movement)
    await db.commit()
    await db.refresh(movement)
    return movement
