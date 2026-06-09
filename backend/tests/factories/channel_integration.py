import uuid

from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import ChannelConnection
from models.enums import ChannelStatus, Ecommerce


class ChannelConnectionFactory(ModelFactory[ChannelConnection]):
    __model__ = ChannelConnection
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    channel = Ecommerce.MERCADO_LIVRE
    status = ChannelStatus.CONNECTED
    access_token = "stub-access"
    refresh_token = "stub-refresh"
    token_expires_at = None
    last_sync_at = None
    external_account_id = "acct-1"
    scopes = "read"


async def create_channel_connection(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    channel: Ecommerce = Ecommerce.MERCADO_LIVRE,
    **overrides,
) -> ChannelConnection:
    conn = ChannelConnectionFactory.build(company_id=company_id, channel=channel, **overrides)
    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return conn
