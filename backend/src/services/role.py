import uuid

from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Role
from shared.exceptions import NotFoundError


async def list_roles(db: AsyncSession) -> list[Role]:
    """All seeded roles ordered by `code`, with their permissions eager-loaded.

    Roles are a global lookup — there is no company scoping. Permissions are
    eager-loaded with selectinload so the response shape is stable regardless
    of how many roles exist.
    """
    stmt = (
        select(Role).options(selectinload(Role.permissions)).order_by(Role.code.asc())  # type: ignore[attr-defined]
    )
    result = await db.exec(stmt)
    return list(result.all())


async def get_role(db: AsyncSession, role_id: uuid.UUID) -> Role:
    """Single role by id, with permissions eager-loaded."""
    stmt = select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id)
    result = await db.exec(stmt)
    role = result.first()
    if role is None:
        raise NotFoundError(detail="Role not found")
    return role
