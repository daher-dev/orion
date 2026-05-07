import uuid

from sqlalchemy import Column, ForeignKey, Uuid
from sqlmodel import Field, SQLModel

from models.base import BaseModel


class Role(BaseModel, table=True):
    __tablename__ = "roles"

    code: str = Field(max_length=50, unique=True, index=True)
    name: str = Field(max_length=100)
    description: str | None = Field(default=None, max_length=255)


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
