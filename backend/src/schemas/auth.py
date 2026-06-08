import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserSummary(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    is_operator: bool


class CompanySummary(BaseModel):
    id: uuid.UUID
    name: str
    subdomain: str
    main_color: str


class RoleSummary(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None = None


class CompanyMembership(BaseModel):
    id: uuid.UUID
    name: str
    role_code: str


class MeResponse(BaseModel):
    user: UserSummary | None = None
    company: CompanySummary | None = None
    role: RoleSummary | None = None
    permissions: list[str] = Field(default_factory=list)
    companies: list[CompanyMembership] = Field(default_factory=list)
    # True when the active company is one the operator is impersonating (a
    # support session), not a real membership. Drives the support-session banner.
    impersonating: bool = False


class InviteCreate(BaseModel):
    email: EmailStr
    role_id: uuid.UUID
    expires_in_hours: int = Field(default=168, ge=1, le=24 * 30)


class InviteResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    email: str
    role_id: uuid.UUID
    token: str
    expires_at: datetime
    accepted_at: datetime | None = None


class InvitePublicResponse(BaseModel):
    """Limited invite information shown on the public accept page."""

    email: str
    company_name: str
    role_name: str
    expires_at: datetime


class InviteAccept(BaseModel):
    name: str | None = Field(default=None, max_length=120)


class InviteAcceptResponse(BaseModel):
    company: CompanySummary
    user: UserSummary
    role: RoleSummary


class LoginAttemptRead(BaseModel):
    """A single login-gate attempt, for the admin troubleshooting view."""

    id: uuid.UUID
    created_at: datetime
    email: str
    firebase_uid: str | None = None
    email_verified: bool
    outcome: str
    company_id: uuid.UUID | None = None
    detail: str | None = None


class LoginAttemptPage(BaseModel):
    items: list[LoginAttemptRead]
    total: int
