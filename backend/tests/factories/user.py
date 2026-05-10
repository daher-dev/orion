import uuid

from polyfactory import Use
from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import User
from tests.factories.role import get_admin_role


class UserFactory(ModelFactory[User]):
    __model__ = User
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    is_operator = False
    firebase_uid = Use(lambda: f"fb-{uuid.uuid4().hex}")
    email = Use(lambda: f"user-{uuid.uuid4().hex[:8]}@orion.test")


async def create_user(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    role_id: uuid.UUID | None = None,
    **overrides,
) -> User:
    if role_id is None:
        role_id = (await get_admin_role(db)).id
    user = UserFactory.build(company_id=company_id, role_id=role_id, **overrides)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
