import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status

from dependencies import DbSession, RequirePermission
from models import Role, User
from schemas.role import RoleCreate, RoleList, RoleRead, RoleUpdate
from services.role import create_role, delete_role, get_role, list_roles, update_role

router = APIRouter(
    prefix="/roles",
    tags=["roles"],
    dependencies=[Depends(RequirePermission("roles.read"))],
)


def _to_read(role: Role) -> RoleRead:
    return RoleRead.from_role(role)


@router.get("", response_model=RoleList)
async def list_roles_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("roles.read"))],
) -> RoleList:
    roles = await list_roles(db, user.company_id)
    return [_to_read(r) for r in roles]


@router.get("/{role_id}", response_model=RoleRead)
async def get_role_endpoint(
    role_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("roles.read"))],
) -> RoleRead:
    role = await get_role(db, user.company_id, role_id)
    return _to_read(role)


@router.post("", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
async def create_role_endpoint(
    payload: RoleCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("roles.write"))],
) -> RoleRead:
    role = await create_role(db, user.company_id, user.id, payload)
    return _to_read(role)


@router.patch("/{role_id}", response_model=RoleRead)
async def update_role_endpoint(
    role_id: uuid.UUID,
    payload: RoleUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("roles.write"))],
) -> RoleRead:
    role = await update_role(db, user.company_id, user.id, role_id, payload)
    return _to_read(role)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role_endpoint(
    role_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("roles.write"))],
) -> None:
    await delete_role(db, user.company_id, user.id, role_id)
