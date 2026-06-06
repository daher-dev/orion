from sqlalchemy import CheckConstraint
from sqlmodel import Field

from models.base import BaseModel


class Company(BaseModel, table=True):
    __tablename__ = "companies"
    __table_args__ = (CheckConstraint(r"main_color ~ '^#[0-9A-Fa-f]{6}$'", name="main_color_hex"),)

    name: str = Field(max_length=120)
    subdomain: str = Field(max_length=63, unique=True, index=True)
    main_color: str = Field(max_length=7)
    # Email of the account on the Montador DTF service that receives this
    # company's print jobs (sent as ``owner_email`` in each request).
    montador_user_email: str | None = Field(default=None, max_length=255)
