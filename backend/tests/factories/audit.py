import uuid

from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import AuditLog


class AuditLogFactory(ModelFactory[AuditLog]):
    __model__ = AuditLog
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    user_id = None


async def create_audit_log(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    resource_type: str,
    resource_id: uuid.UUID,
    **overrides,
) -> AuditLog:
    audit = AuditLogFactory.build(
        company_id=company_id,
        resource_type=resource_type,
        resource_id=resource_id,
        **overrides,
    )
    db.add(audit)
    await db.commit()
    await db.refresh(audit)
    return audit
