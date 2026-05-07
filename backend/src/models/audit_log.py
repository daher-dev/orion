import uuid

from sqlalchemy import Column, ForeignKey, Index, Uuid
from sqlmodel import Field

from models.base import CompanyModel


class AuditLog(CompanyModel, table=True):
    """Append-only trail of changes to domain resources.

    The `created_at` inherited from `BaseModel` is the timestamp.
    `resource_id` is intentionally not a foreign key — audit rows must
    survive deletion of the resource they describe.
    """

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index(
            "ix_audit_logs_company_id_resource_type_resource_id_created_at",
            "company_id",
            "resource_type",
            "resource_id",
            "created_at",
        ),
        Index("ix_audit_logs_company_id_created_at", "company_id", "created_at"),
    )

    # Who made the change. Nullable because the user may be deleted later
    # (FK SET NULL) or the action may be system-driven (jobs, migrations).
    user_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )

    # Which record was touched. `resource_type` is typically the target
    # table name (e.g. "products", "cutting_orders").
    resource_type: str = Field(max_length=80)
    resource_id: uuid.UUID

    message: str
