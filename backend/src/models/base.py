import uuid
from datetime import datetime

from sqlalchemy import DateTime, text
from sqlmodel import Field, SQLModel

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
SQLModel.metadata.naming_convention = NAMING_CONVENTION


class BaseModel(SQLModel):
    id: uuid.UUID = Field(
        default=None,
        primary_key=True,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )
    created_at: datetime = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={"server_default": text("now()"), "nullable": False},
    )
    updated_at: datetime = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={
            "server_default": text("now()"),
            "onupdate": text("now()"),
            "nullable": False,
        },
    )


class CompanyModel(BaseModel):
    """Base for tables scoped to a tenant (company).

    The `ondelete='CASCADE'` is enforced in the migration, not on this
    column — `sa_column=Column()` in a base class shares a single Column
    object across subclasses, which SQLAlchemy rejects.
    """

    company_id: uuid.UUID = Field(foreign_key="companies.id", nullable=False, index=True)
