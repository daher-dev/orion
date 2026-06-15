import uuid

from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import AssemblyRun


class AssemblyRunFactory(ModelFactory[AssemblyRun]):
    __model__ = AssemblyRun
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    quantity = 1
    batch_id = None


async def create_assembly_run(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    blank_piece_id: uuid.UUID,
    printed_transfer_id: uuid.UUID,
    variation_id: uuid.UUID,
    **overrides,
) -> AssemblyRun:
    run = AssemblyRunFactory.build(
        company_id=company_id,
        blank_piece_id=blank_piece_id,
        printed_transfer_id=printed_transfer_id,
        variation_id=variation_id,
        **overrides,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run
