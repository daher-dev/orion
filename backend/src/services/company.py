import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Company
from schemas.company import CompanyUpdate
from services._audit import write_audit
from shared.exceptions import NotFoundError


async def get_company(db: AsyncSession, company_id: uuid.UUID) -> Company:
    result = await db.exec(select(Company).where(Company.id == company_id))
    company = result.first()
    if company is None:
        raise NotFoundError(detail="Company not found")
    return company


async def update_company(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: CompanyUpdate,
) -> Company:
    company = await get_company(db, company_id)

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is None:
            continue
        setattr(company, field, value)

    db.add(company)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="companies",
        resource_id=company.id,
        message=f"Updated company {company.name}",
    )

    await db.commit()
    await db.refresh(company)
    return company
