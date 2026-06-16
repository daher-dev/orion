"""Service layer for the per-company stock-alert threshold.

The threshold is stored as ``Company.low_stock_threshold`` (a scalar column on
the company row rather than a dedicated settings table). Reads return the stored
value; writes persist + audit. Tenant scoping is implicit because every
operation targets the caller's own ``company_id``.
"""

import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Company
from services._audit import write_audit
from shared.exceptions import NotFoundError


async def _get_company(db: AsyncSession, company_id: uuid.UUID) -> Company:
    result = await db.exec(select(Company).where(Company.id == company_id))
    company = result.first()
    if company is None:
        raise NotFoundError(detail="Company not found")
    return company


async def get_threshold(db: AsyncSession, *, company_id: uuid.UUID) -> int:
    """Return the company's configured low-stock threshold."""

    company = await _get_company(db, company_id)
    return company.low_stock_threshold


async def set_threshold(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    threshold: int,
) -> int:
    """Persist a new company-wide low-stock threshold and audit the change."""

    threshold = max(0, threshold)
    company = await _get_company(db, company_id)
    company.low_stock_threshold = threshold
    db.add(company)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="companies",
        resource_id=company.id,
        message=f"Updated low-stock threshold to {threshold}",
    )

    await db.commit()
    await db.refresh(company)
    return company.low_stock_threshold


__all__ = ["get_threshold", "set_threshold"]
