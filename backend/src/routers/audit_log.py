"""HTTP layer for the audit-log viewer (FEATURE-018).

Exposes a single read-only endpoint:

    GET /v1/audit-logs

Tenant scope, sorting, and joined-load of the author user happen in
``services.audit_log``. This module is intentionally thin — parses query
params, runs the service, and shapes the response into ``AuditLogPage``.

Permissions
-----------
There is no dedicated ``audit.read`` permission code yet (the seed
migration in ``alembic/versions/3187f02cbc35_seed_roles_and_permissions``
only ships ``<domain>.<read|write>`` codes for the existing CRUD
features). We gate on ``users.read`` for v1 — every admin and manager
already holds it, while operators do not. A follow-up migration should
add a proper ``audit.read`` code and shift the dependency.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from dependencies import DbSession, RequirePermission
from models import User
from schemas._common import PageParams
from schemas.audit_log import (
    AuditLogActor,
    AuditLogFilters,
    AuditLogPage,
    AuditLogRead,
)
from services.audit_log import AuditLogRow, list_audit_logs

router = APIRouter(
    prefix="/audit-logs",
    tags=["audit-logs"],
    dependencies=[Depends(RequirePermission("users.read"))],
)


def _to_read(row: AuditLogRow) -> AuditLogRead:
    """Project an ``AuditLogRow`` into the public read schema."""

    user = row.user
    return AuditLogRead(
        id=row.audit.id,
        user=AuditLogActor(id=user.id, name=user.name) if user is not None else None,
        resource_type=row.audit.resource_type,
        resource_id=row.audit.resource_id,
        message=row.audit.message,
        created_at=row.audit.created_at,
    )


@router.get("", response_model=AuditLogPage)
async def list_audit_logs_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("users.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    resource_type: Annotated[str | None, Query(max_length=80)] = None,
    user_id: Annotated[uuid.UUID | None, Query()] = None,
    date_from: Annotated[datetime | None, Query()] = None,
    date_to: Annotated[datetime | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> AuditLogPage:
    """List audit entries for the active tenant, ordered by newest first."""

    filters = AuditLogFilters(
        q=q,
        resource_type=resource_type,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )
    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_audit_logs(db, user.company_id, filters, params)
    return AuditLogPage.build([_to_read(r) for r in rows], total, params)
