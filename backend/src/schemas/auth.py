import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

_SUBDOMAIN_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
_HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


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


class OnboardingRequest(BaseModel):
    company_name: str = Field(min_length=1, max_length=120)
    subdomain: str = Field(min_length=1, max_length=63)
    main_color: str = Field(default="#2563eb", max_length=7)

    @field_validator("subdomain")
    @classmethod
    def _validate_subdomain(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not _SUBDOMAIN_RE.match(normalized):
            raise ValueError("subdomain must be lowercase alphanumeric and may contain hyphens")
        return normalized

    @field_validator("main_color")
    @classmethod
    def _validate_color(cls, value: str) -> str:
        if not _HEX_COLOR_RE.match(value):
            raise ValueError("main_color must be a 6-digit hex color like #2563eb")
        return value


class OnboardingResponse(BaseModel):
    company: CompanySummary
    user: UserSummary
    role: RoleSummary


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
