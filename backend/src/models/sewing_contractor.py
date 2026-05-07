from sqlalchemy import UniqueConstraint
from sqlmodel import Field

from models.base import CompanyModel


class SewingContractor(CompanyModel, table=True):
    __tablename__ = "sewing_contractors"
    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_sewing_contractors_company_id_name"),)

    name: str = Field(max_length=120)
    address: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)
