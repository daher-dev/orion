import uuid

from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Client


class ClientFactory(ModelFactory[Client]):
    __model__ = Client
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True


async def create_client(db: AsyncSession, *, company_id: uuid.UUID, **overrides) -> Client:
    client = ClientFactory.build(company_id=company_id, **overrides)
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client
