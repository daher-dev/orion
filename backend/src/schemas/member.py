import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from schemas._common import Page
from schemas.role import RoleRead


class MemberRead(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    job: str | None = None
    is_operator: bool
    role: RoleRead
    created_at: datetime


class MemberRoleUpdate(BaseModel):
    role_id: uuid.UUID = Field(description="Target role id (must be a seeded global role).")


MemberPage = Page[MemberRead]
