import uuid

from sqlalchemy import Column, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field, Relationship, SQLModel

from models.base import BaseModel


class Role(BaseModel, table=True):
    __tablename__ = "roles"
    __table_args__ = (
        # Codes are unique *per owner*: NULL company_id = global seeded role
        # (admin/manager/operator), non-NULL = a tenant-owned custom role. Two
        # companies may each define a `sales` role, while seeded codes stay
        # unique among globals (Postgres treats NULLs as distinct in a unique
        # constraint, so the seeded rows never collide with each other).
        UniqueConstraint("company_id", "code", name="uq_roles_company_id_code"),
    )

    # NULL = global seeded role (shared across tenants, drives enforcement and
    # bootstrap). Non-NULL = a custom role owned by a single company.
    company_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
    )
    # Indexed but NOT globally unique — uniqueness is enforced per owner via the
    # composite constraint above.
    code: str = Field(max_length=50, index=True)
    name: str = Field(max_length=100)
    description: str | None = Field(default=None, max_length=255)

    permissions: list[Permission] = Relationship(
        sa_relationship_kwargs={
            "secondary": "role_permissions",
            "lazy": "selectin",
        },
    )


class Permission(BaseModel, table=True):
    __tablename__ = "permissions"

    code: str = Field(max_length=80, unique=True, index=True)
    description: str = Field(max_length=255)


class RolePermission(SQLModel, table=True):
    __tablename__ = "role_permissions"

    role_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("roles.id", ondelete="CASCADE"),
            primary_key=True,
            index=True,
        ),
    )
    permission_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("permissions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
