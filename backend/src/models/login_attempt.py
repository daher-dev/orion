import uuid

from sqlalchemy import Boolean, Column, Index
from sqlmodel import Field

from models.base import BaseModel
from models.enums import LoginOutcome
from models.pg_enums import LOGIN_OUTCOME


class LoginAttempt(BaseModel, table=True):
    """Append-only record of every login-gate (`establish_session`) attempt.

    Deliberately NOT tenant-scoped: a denied login has no company and no user
    by definition, so this cannot live in the company-scoped `audit_logs`.
    `company_id` is set only on a successful resolve; it is a plain nullable
    UUID (not an FK) so the row survives company deletion and never blocks one.

    No PII beyond the email already supplied by the identity provider; tokens
    and credentials are never stored.
    """

    __tablename__ = "login_attempts"
    __table_args__ = (
        Index("ix_login_attempts_email_created_at", "email", "created_at"),
        Index("ix_login_attempts_outcome_created_at", "outcome", "created_at"),
    )

    # Lower-cased email from the verified token (may be empty if absent).
    email: str = Field(max_length=255, index=True)
    # Firebase identity that attempted, when present.
    firebase_uid: str | None = Field(default=None, max_length=128)
    # Whether the identity provider marked the email verified.
    email_verified: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
    )
    outcome: LoginOutcome = Field(sa_type=LOGIN_OUTCOME)
    # Set only on success — which company the identity resolved into.
    company_id: uuid.UUID | None = Field(default=None)
    # Optional free-text context (e.g. "accepted 1 invite", "no membership").
    detail: str | None = Field(default=None, max_length=255)
