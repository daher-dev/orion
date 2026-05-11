import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from schemas._common import Page
from schemas.role import RoleRead


class InviteCreate(BaseModel):
    email: EmailStr
    role_id: uuid.UUID
    expires_in_hours: int = Field(default=168, ge=1, le=24 * 30)


class InvitedBySummary(BaseModel):
    id: uuid.UUID
    name: str


class InviteRead(BaseModel):
    id: uuid.UUID
    email: str
    role: RoleRead
    invited_by: InvitedBySummary | None = None
    token: str
    accepted_at: datetime | None = None
    expires_at: datetime
    created_at: datetime


InvitePage = Page[InviteRead]
