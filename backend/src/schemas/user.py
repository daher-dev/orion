import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from schemas.auth import RoleSummary


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    job: str | None = Field(default=None, max_length=120)


class UserRead(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    job: str | None = None
    is_operator: bool
    role: RoleSummary
    created_at: datetime
    updated_at: datetime
