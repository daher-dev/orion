import uuid

from pydantic import BaseModel


class PermissionRead(BaseModel):
    code: str
    description: str | None = None


class RoleRead(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None = None
    permissions: list[PermissionRead] = []


RoleList = list[RoleRead]
