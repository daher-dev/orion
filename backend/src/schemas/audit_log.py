"""Schemas for the audit-log viewer (FEATURE-018).

Audit entries are immutable, so we only ship a read shape plus the filters
the router accepts on the list endpoint. There's no Create/Update schema —
mutations go through the internal ``services._audit.write_audit`` helper.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from schemas._common import Page


class AuditLogActor(BaseModel):
    """Minimal projection of the user that authored the audit entry.

    A separate model (rather than reusing ``UserRead``) so the audit list
    payload stays small — we only need the actor's name for the table.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class AuditLogRead(BaseModel):
    """Public shape of an audit-log entry.

    ``user`` is nullable because the FK is ``SET NULL`` — the actor row may
    have been deleted after the event was recorded.
    """

    id: uuid.UUID
    user: AuditLogActor | None = None
    resource_type: str
    resource_id: uuid.UUID
    message: str
    created_at: datetime


class AuditLogFilters(BaseModel):
    """Query-string filters accepted by ``GET /v1/audit-logs``.

    ``q`` matches case-insensitively against ``message`` and ``resource_type``.
    Date bounds are timezone-aware datetimes; the router clients send ISO
    strings and FastAPI parses them.
    """

    q: str | None = Field(default=None, max_length=120)
    resource_type: str | None = Field(default=None, max_length=80)
    user_id: uuid.UUID | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None


AuditLogPage = Page[AuditLogRead]


__all__ = [
    "AuditLogActor",
    "AuditLogFilters",
    "AuditLogPage",
    "AuditLogRead",
]
