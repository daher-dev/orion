from sqlmodel import Field

from models.base import CompanyModel


class Client(CompanyModel, table=True):
    __tablename__ = "clients"

    name: str = Field(max_length=120)
    address: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=255)
