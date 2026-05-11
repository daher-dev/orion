"""Read-only service layer for the audit-log viewer (FEATURE-018).

Audit entries are append-only: writes happen exclusively through
``services._audit.write_audit`` from inside each domain service. This module
only exposes a tenant-scoped list query — there is intentionally no
``create``, ``update``, or ``delete``.

Tenant isolation is enforced by ``scoped()``; the author user is fetched
via a LEFT OUTER JOIN so rows whose author was later deleted (the FK is
``SET NULL``) still surface with ``user = None``.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import AuditLog, User
from schemas._common import PageParams
from schemas.audit_log import AuditLogFilters
from services._base import scoped


@dataclass(slots=True)
class AuditLogRow:
    """Row projection returned by :func:`list_audit_logs`.

    Bundles the ``AuditLog`` instance with the (possibly ``None``) author
    so the router can build the response without lazy-loading.
    """

    audit: AuditLog
    user: User | None


def _apply_filters(stmt, filters: AuditLogFilters):
    """Apply the user-controlled filter clauses to the SELECT statement."""

    if filters.q:
        needle = f"%{filters.q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(AuditLog.message).like(needle),
                func.lower(AuditLog.resource_type).like(needle),
            )
        )
    if filters.resource_type:
        stmt = stmt.where(AuditLog.resource_type == filters.resource_type)
    if filters.user_id is not None:
        stmt = stmt.where(AuditLog.user_id == filters.user_id)
    if filters.date_from is not None:
        stmt = stmt.where(AuditLog.created_at >= filters.date_from)
    if filters.date_to is not None:
        stmt = stmt.where(AuditLog.created_at <= filters.date_to)
    return stmt


async def list_audit_logs(
    db: AsyncSession,
    company_id: uuid.UUID,
    filters: AuditLogFilters,
    page: PageParams,
) -> tuple[list[AuditLogRow], int]:
    """Return ``(rows, total)`` for the given tenant + filter combination.

    Rows are projected via :class:`AuditLogRow` to bundle each entry with
    its author (or ``None`` when the FK is null or the user was deleted).
    Sort order is ``created_at DESC`` — newest first.
    """

    count_stmt = scoped(select(func.count()).select_from(AuditLog), AuditLog, company_id)
    count_stmt = _apply_filters(count_stmt, filters)
    total_result = await db.exec(count_stmt)
    total = int(total_result.one() or 0)

    rows_stmt = scoped(
        select(AuditLog, User).join(User, AuditLog.user_id == User.id, isouter=True),
        AuditLog,
        company_id,
    )
    rows_stmt = _apply_filters(rows_stmt, filters)
    rows_stmt = (
        rows_stmt.order_by(AuditLog.created_at.desc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    rows_result = await db.exec(rows_stmt)
    return [AuditLogRow(audit=audit, user=user) for audit, user in rows_result.all()], total


__all__ = ["AuditLogRow", "list_audit_logs"]
