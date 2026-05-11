import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import Invite, Role, User
from schemas._common import PageParams
from schemas.invite import InviteCreate, InvitedBySummary, InvitePage, InviteRead
from schemas.role import PermissionRead, RoleRead
from services.invite import (
    create_invite,
    get_invite,
    list_invites,
    revoke_invite,
)

router = APIRouter(
    prefix="/invites",
    tags=["invites"],
    dependencies=[Depends(RequirePermission("users.read"))],
)


def _role_to_read(role: Role) -> RoleRead:
    return RoleRead(
        id=role.id,
        code=role.code,
        name=role.name,
        description=role.description,
        permissions=[PermissionRead(code=p.code, description=p.description) for p in role.permissions],
    )


def _to_read(invite: Invite, role: Role, inviter: User | None) -> InviteRead:
    return InviteRead(
        id=invite.id,
        email=invite.email,
        role=_role_to_read(role),
        invited_by=(InvitedBySummary(id=inviter.id, name=inviter.name) if inviter else None),
        token=invite.token,
        accepted_at=invite.accepted_at,
        expires_at=invite.expires_at,
        created_at=invite.created_at,
    )


@router.get("", response_model=InvitePage)
async def list_invites_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("users.read"))],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> InvitePage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_invites(db, user.company_id, params)
    items = [_to_read(invite, role, inviter) for invite, role, inviter in rows]
    return InvitePage.build(items, total, params)


@router.post("", response_model=InviteRead, status_code=status.HTTP_201_CREATED)
async def create_invite_endpoint(
    payload: InviteCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("users.write"))],
) -> InviteRead:
    # Convert our schema to the schemas.auth.InviteCreate that services.auth.create_invite expects.
    from schemas.auth import InviteCreate as AuthInviteCreate

    auth_payload = AuthInviteCreate(
        email=payload.email,
        role_id=payload.role_id,
        expires_in_hours=payload.expires_in_hours,
    )
    invite = await create_invite(
        db,
        company_id=user.company_id,
        invited_by_id=user.id,
        payload=auth_payload,
    )
    # Refetch with joined role to build the response.
    invite_row, role, inviter = await get_invite(db, user.company_id, invite.id)
    return _to_read(invite_row, role, inviter)


@router.delete("/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invite_endpoint(
    invite_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("users.write"))],
) -> None:
    await revoke_invite(db, user.company_id, user.id, invite_id)
