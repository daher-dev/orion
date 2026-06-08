import uuid
from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from models import Role


class PermissionRead(BaseModel):
    code: str
    description: str | None = None


class RoleRead(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None = None
    permissions: list[PermissionRead] = []

    @classmethod
    def from_role(cls, role: Role) -> RoleRead:
        """Build from a Role with its permissions eager-loaded."""
        return cls(
            id=role.id,
            code=role.code,
            name=role.name,
            description=role.description,
            permissions=[PermissionRead(code=p.code, description=p.description) for p in role.permissions],
        )


RoleList = list[RoleRead]
