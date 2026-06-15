import uuid
from datetime import UTC, datetime
from decimal import Decimal

from polyfactory import Use
from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import FabricMovementKind, FabricRoll, FabricRollKind, FabricRollMovement, FabricType


class FabricRollFactory(ModelFactory[FabricRoll]):
    __model__ = FabricRoll
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    kind = FabricRollKind.BODY
    fabric_type = FabricType.JERSEY
    initial_weight_kg = Decimal("25.000")
    current_weight_kg = Decimal("25.000")
    price_per_kg = Decimal("38.00")
    received_at = Use(lambda: datetime.now(UTC).date())


class FabricRollMovementFactory(ModelFactory[FabricRollMovement]):
    __model__ = FabricRollMovement
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    kind = FabricMovementKind.ENTRY
    quantity = Decimal("5.000")
    cutting_order_id = None
    notes = None


async def create_fabric_roll(db: AsyncSession, *, company_id: uuid.UUID, **overrides) -> FabricRoll:
    roll = FabricRollFactory.build(company_id=company_id, **overrides)
    db.add(roll)
    await db.commit()
    await db.refresh(roll)
    return roll


async def create_fabric_roll_movement(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    fabric_roll_id: uuid.UUID,
    **overrides,
) -> FabricRollMovement:
    movement = FabricRollMovementFactory.build(company_id=company_id, fabric_roll_id=fabric_roll_id, **overrides)
    db.add(movement)
    await db.commit()
    await db.refresh(movement)
    return movement
