import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

_HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    main_color: str | None = Field(default=None, max_length=7)
    montador_user_email: str | None = Field(default=None, max_length=255)

    @field_validator("main_color")
    @classmethod
    def _validate_color(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not _HEX_COLOR_RE.match(value):
            raise ValueError("main_color must be a 6-digit hex color like #2563eb")
        return value


class CompanyRead(BaseModel):
    id: uuid.UUID
    name: str
    subdomain: str
    main_color: str
    montador_user_email: str | None = None
    created_at: datetime
    updated_at: datetime
