import uuid

from fastapi import APIRouter, Depends

from dependencies import DbSession, RequirePermission
from models import Role
from schemas.role import PermissionRead, RoleList, RoleRead
from services.role import get_role, list_roles

router = APIRouter(
    prefix="/roles",
    tags=["roles"],
    dependencies=[Depends(RequirePermission("roles.read"))],
)


def _to_read(role: Role) -> RoleRead:
    return RoleRead(
        id=role.id,
        code=role.code,
        name=role.name,
        description=role.description,
        permissions=[PermissionRead(code=p.code, description=p.description) for p in role.permissions],
    )


@router.get("", response_model=RoleList)
async def list_roles_endpoint(db: DbSession) -> RoleList:
    roles = await list_roles(db)
    return [_to_read(r) for r in roles]


@router.get("/{role_id}", response_model=RoleRead)
async def get_role_endpoint(role_id: uuid.UUID, db: DbSession) -> RoleRead:
    role = await get_role(db, role_id)
    return _to_read(role)
