import uuid

from sqlalchemy import func
from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import SewingContractor
from schemas._common import PageParams
from schemas.contractor import ContractorCreate, ContractorFilters, ContractorUpdate
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError

_RESOURCE = "contractors"


async def list_contractors(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: ContractorFilters,
    page: PageParams,
) -> tuple[list[SewingContractor], int]:
    base = scoped(select(SewingContractor), SewingContractor, company_id)
    if filters.q:
        like = f"%{filters.q.strip()}%"
        base = base.where(
            or_(
                SewingContractor.name.ilike(like),  # type: ignore[attr-defined]
                SewingContractor.phone.ilike(like),  # type: ignore[attr-defined]
            )
        )

    total_result = await db.exec(select(func.count()).select_from(base.subquery()))
    total = int(total_result.one() or 0)

    items_stmt = base.order_by(SewingContractor.created_at.desc()).offset(page.offset).limit(page.page_size)  # type: ignore[attr-defined]
    items_result = await db.exec(items_stmt)
    return list(items_result.all()), total


async def get_contractor(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    contractor_id: uuid.UUID,
) -> SewingContractor:
    stmt = scoped(select(SewingContractor), SewingContractor, company_id).where(SewingContractor.id == contractor_id)
    result = await db.exec(stmt)
    contractor = result.first()
    if contractor is None:
        raise NotFoundError(detail="Contractor not found")
    return contractor


async def _assert_unique_name(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    name: str,
    exclude_id: uuid.UUID | None = None,
) -> None:
    stmt = scoped(select(SewingContractor.id), SewingContractor, company_id).where(
        func.lower(SewingContractor.name) == name.strip().lower()
    )
    if exclude_id is not None:
        stmt = stmt.where(SewingContractor.id != exclude_id)
    existing = await db.exec(stmt)
    if existing.first() is not None:
        raise ConflictError(detail="A contractor with this name already exists")


async def create_contractor(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: ContractorCreate,
) -> SewingContractor:
    await _assert_unique_name(db, company_id=company_id, name=payload.name)

    contractor = SewingContractor(
        company_id=company_id,
        name=payload.name.strip(),
        address=payload.address.strip() if payload.address else None,
        phone=payload.phone.strip() if payload.phone else None,
    )
    db.add(contractor)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=contractor.id,
        message=f"Contractor created: {contractor.name}",
    )
    await db.commit()
    await db.refresh(contractor)
    return contractor


async def update_contractor(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    contractor_id: uuid.UUID,
    payload: ContractorUpdate,
) -> SewingContractor:
    contractor = await get_contractor(db, company_id=company_id, contractor_id=contractor_id)

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        new_name = data["name"].strip()
        if new_name.lower() != contractor.name.lower():
            await _assert_unique_name(
                db,
                company_id=company_id,
                name=new_name,
                exclude_id=contractor.id,
            )
        contractor.name = new_name
    if "address" in data:
        contractor.address = data["address"].strip() if data["address"] else None
    if "phone" in data:
        contractor.phone = data["phone"].strip() if data["phone"] else None

    db.add(contractor)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=contractor.id,
        message=f"Contractor updated: {contractor.name}",
    )
    await db.commit()
    await db.refresh(contractor)
    return contractor


async def delete_contractor(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    contractor_id: uuid.UUID,
) -> None:
    contractor = await get_contractor(db, company_id=company_id, contractor_id=contractor_id)

    await db.delete(contractor)
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=contractor.id,
        message=f"Contractor deleted: {contractor.name}",
    )
    await db.commit()
