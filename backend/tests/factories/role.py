from polyfactory.factories.pydantic_factory import ModelFactory
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Permission, Role


class RoleFactory(ModelFactory[Role]):
    __model__ = Role
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True


class PermissionFactory(ModelFactory[Permission]):
    __model__ = Permission
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True


async def get_role_by_code(db: AsyncSession, code: str) -> Role:
    """Look up a seeded role by code (admin, manager, operator)."""

    result = await db.exec(select(Role).where(Role.code == code).options(selectinload(Role.permissions)))
    role = result.first()
    if role is None:
        raise LookupError(f"Role with code '{code}' is not seeded — run `alembic upgrade head`.")
    return role


async def get_admin_role(db: AsyncSession) -> Role:
    return await get_role_by_code(db, "admin")
