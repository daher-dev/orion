import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class OverviewStats(BaseModel):
    """Platform-wide KPIs derived from real tables (no billing/MRR — not modeled)."""

    total_organizations: int
    total_operators: int
    total_members: int
    orders_month: int


class OrgRow(BaseModel):
    """A tenant organization (company) with derived usage counts."""

    id: uuid.UUID
    name: str
    subdomain: str
    accent: str  # company.main_color
    member_count: int
    orders_month: int
    created_at: datetime


class OrgList(BaseModel):
    items: list[OrgRow]
    total: int


class OrgCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    subdomain: str = Field(min_length=1, max_length=63)
    main_color: str = Field(default="#2563eb", pattern=r"^#[0-9A-Fa-f]{6}$")
    owner_email: EmailStr
    owner_name: str | None = Field(default=None, max_length=120)


class OrgCreateResponse(BaseModel):
    organization: OrgRow
    invite_token: str
    owner_email: str


class OperatorRow(BaseModel):
    """A platform staff member — a User flagged is_operator, across any company."""

    id: uuid.UUID
    name: str
    email: str
    company_id: uuid.UUID
    company_name: str
    role_name: str
    created_at: datetime


class OperatorList(BaseModel):
    items: list[OperatorRow]
    total: int


class ImpersonateResponse(BaseModel):
    id: uuid.UUID
    name: str
    subdomain: str
    main_color: str
