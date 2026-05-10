import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from schemas._common import Page


class ContractorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    address: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)


class ContractorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    address: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)


class ContractorRead(BaseModel):
    id: uuid.UUID
    name: str
    address: str | None
    phone: str | None
    created_at: datetime
    updated_at: datetime


class ContractorFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)


ContractorPage = Page[ContractorRead]
