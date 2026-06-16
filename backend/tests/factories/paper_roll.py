import uuid
from datetime import UTC, datetime
from decimal import Decimal

from polyfactory import Use
from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import PaperMovementKind, PaperRoll, PaperRollMovement, PaperType


class PaperRollFactory(ModelFactory[PaperRoll]):
    __model__ = PaperRoll
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    paper_type = PaperType.DTF_FILM
    width_cm = 60
    initial_meters = Decimal("100.00")
    current_meters = Decimal("100.00")
    min_stock = None
    received_at = Use(lambda: datetime.now(UTC).date())


class PaperRollMovementFactory(ModelFactory[PaperRollMovement]):
    __model__ = PaperRollMovement
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    kind = PaperMovementKind.EXIT
    quantity = Decimal("10.000")
    notes = None


async def create_paper_roll(db: AsyncSession, *, company_id: uuid.UUID, **overrides) -> PaperRoll:
    roll = PaperRollFactory.build(company_id=company_id, **overrides)
    db.add(roll)
    await db.commit()
    await db.refresh(roll)
    return roll


async def create_paper_roll_movement(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    paper_roll_id: uuid.UUID,
    **overrides,
) -> PaperRollMovement:
    movement = PaperRollMovementFactory.build(company_id=company_id, paper_roll_id=paper_roll_id, **overrides)
    db.add(movement)
    await db.commit()
    await db.refresh(movement)
    return movement
