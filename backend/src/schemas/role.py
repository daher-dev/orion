from __future__ import annotations

import re
import uuid
from typing import TYPE_CHECKING

from pydantic import BaseModel, field_validator

if TYPE_CHECKING:
    from models import Role

# Reserved codes belong to the global seeded roles and must never be reused
# by a tenant-owned custom role — global enforcement/bootstrap looks these up
# by `code` and expects exactly one (global) row.
RESERVED_ROLE_CODES: frozenset[str] = frozenset({"admin", "manager", "operator"})

_CODE_RE = re.compile(r"^[a-z][a-z0-9_]*$")


class PermissionRead(BaseModel):
    code: str
    description: str | None = None


class RoleRead(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str | None = None
    company_id: uuid.UUID | None = None
    # True for tenant-owned roles (editable/deletable); False for the 3 global
    # seeded roles (read-only).
    is_custom: bool = False
    permissions: list[PermissionRead] = []

    @classmethod
    def from_role(cls, role: Role) -> RoleRead:
        """Build from a Role with its permissions eager-loaded."""
        return cls(
            id=role.id,
            code=role.code,
            name=role.name,
            description=role.description,
            company_id=role.company_id,
            is_custom=role.company_id is not None,
            permissions=[PermissionRead(code=p.code, description=p.description) for p in role.permissions],
        )


class RoleCreate(BaseModel):
    code: str
    name: str
    description: str | None = None
    permission_codes: list[str] = []

    @field_validator("code")
    @classmethod
    def _validate_code(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not _CODE_RE.match(normalized):
            raise ValueError("code must be lowercase alphanumeric/underscore and start with a letter")
        if len(normalized) > 50:
            raise ValueError("code must be at most 50 characters")
        return normalized

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be empty")
        if len(stripped) > 100:
            raise ValueError("name must be at most 100 characters")
        return stripped

    @field_validator("permission_codes")
    @classmethod
    def _dedupe_codes(cls, value: list[str]) -> list[str]:
        # Preserve insertion order while removing duplicates.
        return list(dict.fromkeys(value))


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    permission_codes: list[str] | None = None

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be empty")
        if len(stripped) > 100:
            raise ValueError("name must be at most 100 characters")
        return stripped

    @field_validator("permission_codes")
    @classmethod
    def _dedupe_codes(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return list(dict.fromkeys(value))


RoleList = list[RoleRead]
