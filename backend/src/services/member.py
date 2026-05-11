import uuid

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Role, User
from schemas._common import PageParams
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError

_ADMIN_ROLE_CODE = "admin"


async def _admin_role_id(db: AsyncSession) -> uuid.UUID:
    """Look up the global admin role id — surfaces a clear error if not seeded."""
    result = await db.exec(select(Role.id).where(Role.code == _ADMIN_ROLE_CODE))
    role_id = result.first()
    if role_id is None:  # pragma: no cover - seeded by migration
        raise NotFoundError(detail="Admin role not seeded")
    return role_id


async def _count_remaining_admins(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    admin_role_id: uuid.UUID,
    exclude_user_id: uuid.UUID,
) -> int:
    """Count admins in the company excluding the given user."""
    stmt = scoped(
        select(func.count()).select_from(User),
        User,
        company_id,
    ).where(
        User.role_id == admin_role_id,
        User.id != exclude_user_id,
    )
    result = await db.exec(stmt)
    return int(result.one())


async def list_members(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: PageParams,
) -> tuple[list[User], int]:
    """List the company's members with their role + permissions eager-loaded."""

    count_stmt = scoped(select(func.count()).select_from(User), User, company_id)
    total_result = await db.exec(count_stmt)
    total = int(total_result.one())

    rows_stmt = (
        scoped(select(User), User, company_id)
        .options(selectinload(User.role).selectinload(Role.permissions))
        .order_by(User.created_at.asc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    rows_result = await db.exec(rows_stmt)
    return list(rows_result.all()), total


async def get_member(
    db: AsyncSession,
    company_id: uuid.UUID,
    member_id: uuid.UUID,
) -> User:
    """Fetch a member by id, scoped to the tenant. Eager-loads role + permissions."""
    stmt = (
        scoped(select(User), User, company_id)
        .options(selectinload(User.role).selectinload(Role.permissions))
        .where(User.id == member_id)
    )
    result = await db.exec(stmt)
    member = result.first()
    if member is None:
        raise NotFoundError(detail="Member not found")
    return member


async def update_member_role(
    db: AsyncSession,
    company_id: uuid.UUID,
    actor_id: uuid.UUID,
    member_id: uuid.UUID,
    role_id: uuid.UUID,
) -> User:
    """Change a member's role.

    Guards against demoting the last admin: if `member` is currently an admin and
    the target role isn't admin, refuse when no other admin exists.
    """
    member = await get_member(db, company_id, member_id)

    target_role_result = await db.exec(select(Role).where(Role.id == role_id))
    target_role = target_role_result.first()
    if target_role is None:
        raise NotFoundError(detail="Role not found")

    if member.role_id == role_id:
        # No-op — still return the (eager-loaded) row so the API contract holds.
        return member

    admin_role_id = await _admin_role_id(db)
    old_role = member.role
    old_role_name = old_role.name if old_role is not None else "—"

    is_demoting_admin = member.role_id == admin_role_id and role_id != admin_role_id
    if is_demoting_admin:
        remaining = await _count_remaining_admins(
            db,
            company_id=company_id,
            admin_role_id=admin_role_id,
            exclude_user_id=member.id,
        )
        if remaining == 0:
            raise ConflictError(detail="Cannot remove the last administrator")

    member.role_id = role_id
    db.add(member)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=actor_id,
        resource_type="users",
        resource_id=member.id,
        message=f"Changed role of {member.email} from {old_role_name} to {target_role.name}",
    )

    await db.commit()
    # The joined `role` relationship is stale after the role_id change — expire
    # it so the next access reloads the new role with its permissions.
    await db.refresh(member, attribute_names=["role"])
    return member


async def remove_member(
    db: AsyncSession,
    company_id: uuid.UUID,
    actor_id: uuid.UUID,
    member_id: uuid.UUID,
) -> None:
    """Hard-delete a member. Refuses to remove the last admin in the company."""
    member = await get_member(db, company_id, member_id)
    admin_role_id = await _admin_role_id(db)

    if member.role_id == admin_role_id:
        remaining = await _count_remaining_admins(
            db,
            company_id=company_id,
            admin_role_id=admin_role_id,
            exclude_user_id=member.id,
        )
        if remaining == 0:
            raise ConflictError(detail="Cannot remove the last administrator")

    email = member.email
    await db.delete(member)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=actor_id,
        resource_type="users",
        resource_id=member_id,
        message=f"Removed member {email}",
    )

    await db.commit()
