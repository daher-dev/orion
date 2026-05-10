from typing import Annotated

from fastapi import APIRouter, Depends

from dependencies import CurrentDbUser, DbSession, RequirePermission
from models import User
from schemas.company import CompanyRead, CompanyUpdate
from services.company import get_company, update_company

router = APIRouter(prefix="/companies", tags=["companies"])


def _to_read(company) -> CompanyRead:
    return CompanyRead.model_validate(company, from_attributes=True)


@router.get(
    "/me",
    response_model=CompanyRead,
    dependencies=[Depends(RequirePermission("companies.read"))],
)
async def get_my_company(
    user: CurrentDbUser,
    db: DbSession,
) -> CompanyRead:
    company = await get_company(db, user.company_id)
    return _to_read(company)


@router.patch("/me", response_model=CompanyRead)
async def update_my_company(
    payload: CompanyUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("companies.write"))],
) -> CompanyRead:
    company = await update_company(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return _to_read(company)
