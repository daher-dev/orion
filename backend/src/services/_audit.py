import uuid

from sqlmodel.ext.asyncio.session import AsyncSession

from models import AuditLog


async def write_audit(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    resource_type: str,
    resource_id: uuid.UUID,
    message: str,
) -> AuditLog:
    """Append an audit-log entry. Caller is responsible for the surrounding commit."""

    entry = AuditLog(
        company_id=company_id,
        user_id=user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        message=message,
    )
    db.add(entry)
    await db.flush()
    return entry
