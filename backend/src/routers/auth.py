import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, status
from sqlmodel import select

from dependencies import CurrentClaims, CurrentDbUser, DbSession, RequirePermission
from models import Company, Role, User
from schemas.auth import (
    CompanyMembership,
    CompanySummary,
    InviteAccept,
    InviteAcceptResponse,
    InviteCreate,
    InvitePublicResponse,
    InviteResponse,
    MeResponse,
    OnboardingRequest,
    OnboardingResponse,
    RoleSummary,
    UserSummary,
)
from services._audit import write_audit
from services.auth import (
    accept_invite,
    create_company_and_admin,
    create_invite,
    get_invite_by_token,
    get_user_companies,
    get_user_in_company,
)
from shared.exceptions import AuthorizationError, NotFoundError

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_summaries(user: User, company: Company, role: Role) -> tuple[UserSummary, CompanySummary, RoleSummary]:
    return (
        UserSummary(id=user.id, name=user.name, email=user.email, is_operator=user.is_operator),
        CompanySummary(id=company.id, name=company.name, subdomain=company.subdomain, main_color=company.main_color),
        RoleSummary(id=role.id, code=role.code, name=role.name, description=role.description),
    )


@router.get("/me", response_model=MeResponse)
async def get_me(
    claims: CurrentClaims,
    db: DbSession,
    x_orion_company_id: Annotated[
        uuid.UUID | None,
        Header(alias="X-Orion-Company-Id", convert_underscores=False),
    ] = None,
) -> MeResponse:
    memberships = await get_user_companies(db, claims["uid"])
    if not memberships:
        return MeResponse()

    if x_orion_company_id is not None:
        active = next(
            (m for m in memberships if m[1].id == x_orion_company_id),
            None,
        )
    else:
        active = memberships[0]

    if active is None:
        return MeResponse(
            companies=[
                CompanyMembership(id=company.id, name=company.name, role_code=role.code)
                for _, company, role in memberships
            ],
        )

    user, company, role = active
    user_summary, company_summary, role_summary = _build_summaries(user, company, role)
    permissions = sorted({perm.code for perm in role.permissions})

    return MeResponse(
        user=user_summary,
        company=company_summary,
        role=role_summary,
        permissions=permissions,
        companies=[
            CompanyMembership(id=company_.id, name=company_.name, role_code=role_.code)
            for _, company_, role_ in memberships
        ],
    )


@router.post(
    "/onboarding/companies",
    response_model=OnboardingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_onboarding_company(
    payload: OnboardingRequest,
    claims: CurrentClaims,
    db: DbSession,
) -> OnboardingResponse:
    company, user, role = await create_company_and_admin(db, claims=claims, payload=payload)
    user_summary, company_summary, role_summary = _build_summaries(user, company, role)
    return OnboardingResponse(company=company_summary, user=user_summary, role=role_summary)


@router.post(
    "/invites",
    response_model=InviteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invite_endpoint(
    payload: InviteCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("users.write"))],
) -> InviteResponse:
    invite = await create_invite(
        db,
        company_id=user.company_id,
        invited_by_id=user.id,
        payload=payload,
    )
    return InviteResponse(
        id=invite.id,
        company_id=invite.company_id,
        email=invite.email,
        role_id=invite.role_id,
        token=invite.token,
        expires_at=invite.expires_at,
        accepted_at=invite.accepted_at,
    )


@router.get("/invites/{token}", response_model=InvitePublicResponse)
async def get_invite_public(token: str, db: DbSession) -> InvitePublicResponse:
    invite = await get_invite_by_token(db, token)
    company_result = await db.exec(select(Company).where(Company.id == invite.company_id))
    company = company_result.first()
    if company is None:
        raise NotFoundError(detail="Company not found")
    role_result = await db.exec(select(Role).where(Role.id == invite.role_id))
    role = role_result.first()
    if role is None:
        raise NotFoundError(detail="Role not found")
    return InvitePublicResponse(
        email=invite.email,
        company_name=company.name,
        role_name=role.name,
        expires_at=invite.expires_at,
    )


@router.post("/invites/{token}/accept", response_model=InviteAcceptResponse)
async def accept_invite_endpoint(
    token: str,
    payload: InviteAccept,
    claims: CurrentClaims,
    db: DbSession,
) -> InviteAcceptResponse:
    company, user, role = await accept_invite(
        db,
        claims=claims,
        token=token,
        name_override=payload.name,
    )
    user_summary, company_summary, role_summary = _build_summaries(user, company, role)
    return InviteAcceptResponse(company=company_summary, user=user_summary, role=role_summary)


@router.post(
    "/companies/{company_id}/switch",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def switch_company(
    company_id: uuid.UUID,
    user: CurrentDbUser,
    db: DbSession,
) -> None:
    target = await get_user_in_company(db, firebase_uid=user.firebase_uid, company_id=company_id)
    if target is None:
        raise AuthorizationError(detail="No membership in target company")
    await write_audit(
        db,
        company_id=company_id,
        user_id=target.id,
        resource_type="users",
        resource_id=target.id,
        message="Switched active company",
    )
    await db.commit()
