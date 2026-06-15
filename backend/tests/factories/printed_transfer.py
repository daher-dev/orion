import uuid

from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import PrintedMovementKind, PrintedTransfer, PrintedTransferMovement, PrintSide


class PrintedTransferFactory(ModelFactory[PrintedTransfer]):
    __model__ = PrintedTransfer
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    side = PrintSide.FRONT
    min_stock = None


class PrintedTransferMovementFactory(ModelFactory[PrintedTransferMovement]):
    __model__ = PrintedTransferMovement
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    kind = PrintedMovementKind.ENTRY
    quantity = 10
    notes = None


async def create_printed_transfer(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    print_design_id: uuid.UUID,
    **overrides,
) -> PrintedTransfer:
    transfer = PrintedTransferFactory.build(company_id=company_id, print_design_id=print_design_id, **overrides)
    db.add(transfer)
    await db.commit()
    await db.refresh(transfer)
    return transfer


async def create_printed_transfer_movement(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    printed_transfer_id: uuid.UUID,
    **overrides,
) -> PrintedTransferMovement:
    movement = PrintedTransferMovementFactory.build(
        company_id=company_id, printed_transfer_id=printed_transfer_id, **overrides
    )
    db.add(movement)
    await db.commit()
    await db.refresh(movement)
    return movement
