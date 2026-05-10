import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import User
from schemas.user import UserUpdate
from services._audit import write_audit
from shared.exceptions import NotFoundError


async def update_user_self(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: UserUpdate,
) -> User:
    """Update the active user's editable profile fields (name, job)."""

    result = await db.exec(
        select(User).where(User.id == user_id, User.company_id == company_id)
    )
    user = result.first()
    if user is None:
        raise NotFoundError(detail="User not found")

    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is not None:
        user.name = changes["name"]
    if "job" in changes:
        # `job` is nullable — explicit None or empty string clears it.
        value = changes["job"]
        user.job = value if value else None

    db.add(user)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="users",
        resource_id=user.id,
        message=f"Updated profile for {user.email}",
    )

    await db.commit()
    await db.refresh(user)
    return user
