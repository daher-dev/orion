import secrets
import uuid
from datetime import UTC, datetime, timedelta

from polyfactory import Use
from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Invite


class InviteFactory(ModelFactory[Invite]):
    __model__ = Invite
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    token = Use(lambda: secrets.token_urlsafe(32))
    email = Use(lambda: f"invite-{uuid.uuid4().hex[:8]}@orion.test")
    accepted_at = None
    accepted_by_id = None
    invited_by_id = None
    expires_at = Use(lambda: datetime.now(UTC) + timedelta(days=7))


async def create_invite(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    role_id: uuid.UUID,
    **overrides,
) -> Invite:
    invite = InviteFactory.build(company_id=company_id, role_id=role_id, **overrides)
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    return invite
