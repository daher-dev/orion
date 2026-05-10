import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Uuid, text
from sqlmodel import Field

from models.base import CompanyModel


class Invite(CompanyModel, table=True):
    """Pending invite for a Firebase identity to join a company with a given role.

    A partial unique index prevents duplicate *unaccepted* invites for the same
    (company, email) pair while still allowing the same email to accept multiple
    successive invites historically.
    """

    __tablename__ = "invites"
    __table_args__ = (
        Index(
            "uq_invites_company_id_email_pending",
            "company_id",
            "email",
            unique=True,
            postgresql_where=text("accepted_at IS NULL"),
        ),
    )

    token: str = Field(max_length=64, unique=True, index=True)
    email: str = Field(max_length=255)
    role_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("roles.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    invited_by_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    accepted_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    accepted_by_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
