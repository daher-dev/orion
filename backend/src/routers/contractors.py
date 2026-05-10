import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import User
from schemas._common import PageParams
from schemas.contractor import (
    ContractorCreate,
    ContractorFilters,
    ContractorPage,
    ContractorRead,
    ContractorUpdate,
)
from services.contractor import (
    create_contractor,
    delete_contractor,
    get_contractor,
    list_contractors,
    update_contractor,
)

router = APIRouter(
    prefix="/contractors",
    tags=["Contractors"],
    dependencies=[Depends(RequirePermission("contractors.read"))],
)


def _to_read(contractor) -> ContractorRead:
    return ContractorRead(
        id=contractor.id,
        name=contractor.name,
        address=contractor.address,
        phone=contractor.phone,
        created_at=contractor.created_at,
        updated_at=contractor.updated_at,
    )


@router.get("", response_model=ContractorPage)
async def list_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("contractors.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> ContractorPage:
    params = PageParams(page=page, page_size=page_size)
    items, total = await list_contractors(
        db,
        company_id=user.company_id,
        filters=ContractorFilters(q=q),
        page=params,
    )
    return ContractorPage.build([_to_read(item) for item in items], total, params)


@router.get("/{contractor_id}", response_model=ContractorRead)
async def get_endpoint(
    contractor_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("contractors.read"))],
) -> ContractorRead:
    contractor = await get_contractor(db, company_id=user.company_id, contractor_id=contractor_id)
    return _to_read(contractor)


@router.post("", response_model=ContractorRead, status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    payload: ContractorCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("contractors.write"))],
) -> ContractorRead:
    contractor = await create_contractor(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return _to_read(contractor)


@router.patch("/{contractor_id}", response_model=ContractorRead)
async def update_endpoint(
    contractor_id: uuid.UUID,
    payload: ContractorUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("contractors.write"))],
) -> ContractorRead:
    contractor = await update_contractor(
        db,
        company_id=user.company_id,
        user_id=user.id,
        contractor_id=contractor_id,
        payload=payload,
    )
    return _to_read(contractor)


@router.delete("/{contractor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_endpoint(
    contractor_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("contractors.write"))],
) -> None:
    await delete_contractor(
        db,
        company_id=user.company_id,
        user_id=user.id,
        contractor_id=contractor_id,
    )
