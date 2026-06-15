from typing import Annotated

from fastapi import APIRouter, Depends

from dependencies import CurrentDbUser, DbSession, RequirePermission
from models import User
from schemas.company import CompanyRead, CompanyUpdate
from schemas.company_settings import (
    CompanySettingsConfig,
    CompanySettingsRead,
    CompanySettingsUpdate,
)
from services import company_settings as company_settings_service
from services.company import get_company, update_company

router = APIRouter(prefix="/companies", tags=["companies"])

# Settings live under the singular ``/company`` prefix so the wire path is
# ``/v1/company/settings`` (distinct from the ``/companies`` collection above).
settings_router = APIRouter(prefix="/company", tags=["companies"])


def _to_read(company) -> CompanyRead:
    return CompanyRead.model_validate(company, from_attributes=True)


def _settings_to_read(settings) -> CompanySettingsRead:
    return CompanySettingsRead(config=CompanySettingsConfig.model_validate(settings.config))


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


@settings_router.get(
    "/settings",
    response_model=CompanySettingsRead,
    dependencies=[Depends(RequirePermission("companies.read"))],
)
async def get_company_settings(
    user: CurrentDbUser,
    db: DbSession,
) -> CompanySettingsRead:
    settings = await company_settings_service.get_settings(db, company_id=user.company_id)
    return _settings_to_read(settings)


@settings_router.put("/settings", response_model=CompanySettingsRead)
async def update_company_settings(
    payload: CompanySettingsUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("companies.write"))],
) -> CompanySettingsRead:
    settings = await company_settings_service.update_settings(
        db,
        company_id=user.company_id,
        user_id=user.id,
        config=payload.config.model_dump(),
    )
    return _settings_to_read(settings)
