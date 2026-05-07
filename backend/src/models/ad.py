import uuid

from sqlalchemy import Column, ForeignKey, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import Ecommerce
from models.pg_enums import ECOMMERCE


class Ad(CompanyModel, table=True):
    """An ecommerce listing pointing at a Product."""

    __tablename__ = "ads"

    title: str = Field(max_length=200)
    ecommerce: Ecommerce = Field(sa_type=ECOMMERCE)
    external_id: str | None = Field(default=None, max_length=120)
    product_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
