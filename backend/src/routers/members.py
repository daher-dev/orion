import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import Role, User
from schemas._common import PageParams
from schemas.member import MemberPage, MemberRead, MemberRoleUpdate
from schemas.role import PermissionRead, RoleRead
from services.member import (
    get_member,
    list_members,
    remove_member,
    update_member_role,
)

router = APIRouter(
    prefix="/members",
    tags=["members"],
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


def _to_read(member: User) -> MemberRead:
    return MemberRead(
        id=member.id,
        name=member.name,
        email=member.email,
        job=member.job,
        is_operator=member.is_operator,
        role=_role_to_read(member.role),
        created_at=member.created_at,
    )


@router.get("", response_model=MemberPage)
async def list_members_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("users.read"))],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> MemberPage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_members(db, user.company_id, params)
    return MemberPage.build([_to_read(r) for r in rows], total, params)


@router.get("/{member_id}", response_model=MemberRead)
async def get_member_endpoint(
    member_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("users.read"))],
) -> MemberRead:
    member = await get_member(db, user.company_id, member_id)
    return _to_read(member)


@router.patch("/{member_id}", response_model=MemberRead)
async def update_member_role_endpoint(
    member_id: uuid.UUID,
    payload: MemberRoleUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("users.write"))],
) -> MemberRead:
    member = await update_member_role(
        db,
        user.company_id,
        user.id,
        member_id,
        payload.role_id,
    )
    return _to_read(member)


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member_endpoint(
    member_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("users.write"))],
) -> None:
    await remove_member(db, user.company_id, user.id, member_id)
