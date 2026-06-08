import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

from schemas._common import Page
from schemas.role import RoleRead

if TYPE_CHECKING:
    from models import User


class MemberRead(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    job: str | None = None
    is_operator: bool
    role: RoleRead
    created_at: datetime

    @classmethod
    def from_user(cls, user: User) -> MemberRead:
        """Build from a User with its role + permissions eager-loaded."""
        return cls(
            id=user.id,
            name=user.name,
            email=user.email,
            job=user.job,
            is_operator=user.is_operator,
            role=RoleRead.from_role(user.role),
            created_at=user.created_at,
        )


class MemberRoleUpdate(BaseModel):
    role_id: uuid.UUID = Field(description="Target role id (must be a seeded global role).")


MemberPage = Page[MemberRead]
