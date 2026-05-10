import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from schemas._common import Page


class ClientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=255)


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=255)


class ClientRead(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    created_at: datetime
    updated_at: datetime


class ClientFilters(BaseModel):
    q: str | None = Field(default=None, max_length=120)


ClientPage = Page[ClientRead]
