from sqlmodel import Field

from models.base import CompanyModel
from models.enums import Ecommerce
from models.pg_enums import ECOMMERCE


class Ad(CompanyModel, table=True):
    """An ecommerce listing. Sells one or more Products via the ``ad_products`` join."""

    __tablename__ = "ads"

    title: str = Field(max_length=200)
    ecommerce: Ecommerce = Field(sa_type=ECOMMERCE)
    external_id: str | None = Field(default=None, max_length=120)
