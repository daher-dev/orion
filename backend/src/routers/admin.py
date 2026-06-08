import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import CurrentOperator, DbSession, get_operator_user
from schemas._common import PageParams
from schemas.admin import (
    ImpersonateResponse,
    OperatorList,
    OrgCreate,
    OrgCreateResponse,
    OrgList,
    OrgRow,
    OverviewStats,
)
from schemas.member import MemberPage
from services.admin import (
    create_organization,
    get_organization,
    list_operators,
    list_organizations,
    overview_stats,
    start_impersonation,
)
from services.member import list_members

# Platform-admin (Console) API. Every route requires an operator (is_operator).
# This is intentionally cross-tenant — operators read across all companies.
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_operator_user)],
)


@router.get("/overview", response_model=OverviewStats)
async def get_overview(db: DbSession) -> OverviewStats:
    total_orgs, total_operators, total_members, orders_month = await overview_stats(db)
    return OverviewStats(
        total_organizations=total_orgs,
        total_operators=total_operators,
        total_members=total_members,
        orders_month=orders_month,
    )


@router.get("/organizations", response_model=OrgList)
async def list_organizations_endpoint(db: DbSession) -> OrgList:
    rows = await list_organizations(db)
    return OrgList(items=rows, total=len(rows))


@router.post("/organizations", response_model=OrgCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_organization_endpoint(payload: OrgCreate, db: DbSession) -> OrgCreateResponse:
    org, token = await create_organization(db, payload)
    return OrgCreateResponse(organization=org, invite_token=token, owner_email=str(payload.owner_email))


@router.get("/organizations/{company_id}", response_model=OrgRow)
async def get_organization_endpoint(company_id: uuid.UUID, db: DbSession) -> OrgRow:
    return await get_organization(db, company_id)


@router.get("/organizations/{company_id}/members", response_model=MemberPage)
async def list_org_members_endpoint(
    company_id: uuid.UUID,
    db: DbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 100,
) -> MemberPage:
    # Reuse the tenant member service with the target company id (operator scope).
    from routers.members import _to_read

    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_members(db, company_id, params)
    return MemberPage.build([_to_read(r) for r in rows], total, params)


@router.post("/organizations/{company_id}/impersonate", response_model=ImpersonateResponse)
async def impersonate_endpoint(
    company_id: uuid.UUID,
    operator: CurrentOperator,
    db: DbSession,
) -> ImpersonateResponse:
    company = await start_impersonation(db, operator, company_id)
    return ImpersonateResponse(
        id=company.id, name=company.name, subdomain=company.subdomain, main_color=company.main_color
    )


@router.get("/users", response_model=OperatorList)
async def list_operators_endpoint(db: DbSession) -> OperatorList:
    rows = await list_operators(db)
    return OperatorList(items=rows, total=len(rows))
