from sqlalchemy import CheckConstraint
from sqlmodel import Field

from models.base import BaseModel


class Company(BaseModel, table=True):
    __tablename__ = "companies"
    __table_args__ = (CheckConstraint(r"main_color ~ '^#[0-9A-Fa-f]{6}$'", name="main_color_hex"),)

    name: str = Field(max_length=120)
    subdomain: str = Field(max_length=63, unique=True, index=True)
    main_color: str = Field(max_length=7)
    # Company-wide low-stock alert threshold: a variation is "low" when its
    # on-hand quantity is <= this value (unless a per-variation override exists).
    # Backfilled to ``DEFAULT_LOW_STOCK_THRESHOLD`` for existing rows.
    low_stock_threshold: int = Field(default=10, ge=0)
