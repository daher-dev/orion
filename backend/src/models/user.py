import uuid

from sqlalchemy import Column, ForeignKey, UniqueConstraint, Uuid, text
from sqlmodel import Field, Relationship

from models.base import CompanyModel
from models.role import Role


class User(CompanyModel, table=True):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("company_id", "firebase_uid", name="uq_users_company_id_firebase_uid"),
        UniqueConstraint("company_id", "email", name="uq_users_company_id_email"),
    )

    firebase_uid: str = Field(max_length=128, index=True)
    name: str = Field(max_length=120)
    email: str = Field(max_length=255)
    job: str | None = Field(default=None, max_length=120)
    is_operator: bool = Field(
        default=False,
        sa_column_kwargs={"server_default": text("false"), "nullable": False},
    )

    role_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("roles.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )

    role: Role = Relationship(sa_relationship_kwargs={"lazy": "joined"})
