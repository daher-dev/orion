"""Admin-side invite operations.

The public-facing flow (`/v1/auth/invites/{token}` + accept) lives in
:mod:`services.auth`. This module hosts the *list / create / revoke*
endpoints exposed under `/v1/invites` for company administrators.

`create_invite` is implemented in :func:`services.auth.create_invite` already —
we re-export it here so the router and tests can import everything from one
place without coupling to the auth module.
"""

import uuid

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Invite, Role, User
from schemas._common import PageParams
from services._audit import write_audit
from services._base import scoped
from services.auth import create_invite as _create_invite  # re-export
from shared.exceptions import ConflictError, NotFoundError

# Re-export so callers can `from services.invite import create_invite`.
create_invite = _create_invite


async def list_invites(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: PageParams,
) -> tuple[list[tuple[Invite, Role, User | None]], int]:
    """List all invites (pending + accepted) for the active company.

    Returns tuples of ``(invite, role, invited_by_or_none)`` so the router
    can build full :class:`schemas.invite.InviteRead` responses without an
    N+1 round-trip per row. Sorted by ``created_at DESC``.
    """
    count_stmt = scoped(select(func.count()).select_from(Invite), Invite, company_id)
    total_result = await db.exec(count_stmt)
    total = int(total_result.one())

    rows_stmt = (
        select(Invite, Role, User)
        .join(Role, Role.id == Invite.role_id)
        .outerjoin(User, User.id == Invite.invited_by_id)
        .where(Invite.company_id == company_id)
        .options(selectinload(Role.permissions))  # type: ignore[attr-defined]
        .order_by(Invite.created_at.desc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    rows_result = await db.exec(rows_stmt)
    return [(invite, role, user) for invite, role, user in rows_result.all()], total


async def get_invite(
    db: AsyncSession,
    company_id: uuid.UUID,
    invite_id: uuid.UUID,
) -> tuple[Invite, Role, User | None]:
    """Fetch an invite scoped to the tenant, joined with its role and (optional) inviter."""
    stmt = (
        select(Invite, Role, User)
        .join(Role, Role.id == Invite.role_id)
        .outerjoin(User, User.id == Invite.invited_by_id)
        .where(Invite.company_id == company_id, Invite.id == invite_id)
        .options(selectinload(Role.permissions))  # type: ignore[attr-defined]
    )
    result = await db.exec(stmt)
    row = result.first()
    if row is None:
        raise NotFoundError(detail="Invite not found")
    invite, role, inviter = row
    return invite, role, inviter


async def revoke_invite(
    db: AsyncSession,
    company_id: uuid.UUID,
    actor_id: uuid.UUID,
    invite_id: uuid.UUID,
) -> None:
    """Hard-delete an unaccepted invite. Already-accepted invites cannot be revoked."""
    invite, _role, _inviter = await get_invite(db, company_id, invite_id)
    if invite.accepted_at is not None:
        raise ConflictError(detail="Invite has already been accepted")

    email = invite.email
    await db.delete(invite)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=actor_id,
        resource_type="invites",
        resource_id=invite_id,
        message=f"Revoked invite for {email}",
    )

    await db.commit()


__all__ = [
    "create_invite",
    "get_invite",
    "list_invites",
    "revoke_invite",
]
