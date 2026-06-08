import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, status
from sqlalchemy.orm import selectinload
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
    LoginAttemptPage,
    LoginAttemptRead,
    MeResponse,
    RoleSummary,
    UserSummary,
)
from services._audit import write_audit
from services.auth import (
    accept_invite,
    create_invite,
    establish_session,
    get_invite_by_token,
    get_user_companies,
    get_user_in_company,
    list_login_attempts,
)
from shared.exceptions import AuthorizationError, NotFoundError

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_summaries(user: User, company: Company, role: Role) -> tuple[UserSummary, CompanySummary, RoleSummary]:
    return (
        UserSummary(id=user.id, name=user.name, email=user.email, is_operator=user.is_operator),
        CompanySummary(id=company.id, name=company.name, subdomain=company.subdomain, main_color=company.main_color),
        RoleSummary(id=role.id, code=role.code, name=role.name, description=role.description),
    )


def _build_me_response(
    memberships: list[tuple[User, Company, Role]],
    x_orion_company_id: uuid.UUID | None,
) -> MeResponse:
    if not memberships:
        return MeResponse()

    if x_orion_company_id is not None:
        active = next((m for m in memberships if m[1].id == x_orion_company_id), None)
    else:
        active = memberships[0]

    companies = [
        CompanyMembership(id=company.id, name=company.name, role_code=role.code) for _, company, role in memberships
    ]

    if active is None:
        return MeResponse(companies=companies)

    user, company, role = active
    user_summary, company_summary, role_summary = _build_summaries(user, company, role)
    permissions = sorted({perm.code for perm in role.permissions})

    return MeResponse(
        user=user_summary,
        company=company_summary,
        role=role_summary,
        permissions=permissions,
        companies=companies,
    )


async def _build_impersonation_me(
    db: DbSession,
    operator: User,
    company_id: uuid.UUID,
    companies: list[CompanyMembership],
) -> MeResponse | None:
    """Synthesize a `MeResponse` for an operator impersonating a non-member company.

    Returns None when the target company doesn't exist (caller falls back to the
    normal envelope). The operator gets the admin role + permissions for the
    company so the tenant app renders during the support session.
    """
    company = (await db.exec(select(Company).where(Company.id == company_id))).first()
    if company is None:
        return None
    admin_role = (
        await db.exec(select(Role).where(Role.code == "admin").options(selectinload(Role.permissions)))
    ).first()
    if admin_role is None:  # pragma: no cover — seeded by migration
        return None
    return MeResponse(
        user=UserSummary(id=operator.id, name=operator.name, email=operator.email, is_operator=True),
        company=CompanySummary(
            id=company.id, name=company.name, subdomain=company.subdomain, main_color=company.main_color
        ),
        role=RoleSummary(
            id=admin_role.id, code=admin_role.code, name=admin_role.name, description=admin_role.description
        ),
        permissions=sorted({perm.code for perm in admin_role.permissions}),
        companies=companies,
        impersonating=True,
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

    # Operator impersonation: the active company header points somewhere the
    # operator is not a member. Build a support-session envelope instead of an
    # empty one so the tenant app doesn't bounce them to /access-denied.
    if x_orion_company_id is not None and memberships:
        is_member = any(company.id == x_orion_company_id for _, company, _ in memberships)
        operator_user = memberships[0][0]
        if not is_member and operator_user.is_operator:
            companies = [
                CompanyMembership(id=company.id, name=company.name, role_code=role.code)
                for _, company, role in memberships
            ]
            impersonated = await _build_impersonation_me(db, operator_user, x_orion_company_id, companies)
            if impersonated is not None:
                return impersonated

    return _build_me_response(memberships, x_orion_company_id)


@router.post("/session", response_model=MeResponse)
async def establish_session_endpoint(
    claims: CurrentClaims,
    db: DbSession,
    x_orion_company_id: Annotated[
        uuid.UUID | None,
        Header(alias="X-Orion-Company-Id", convert_underscores=False),
    ] = None,
) -> MeResponse:
    """Login gate: resolve or provision the caller's memberships.

    Returns the membership envelope when the identity is already a member or has a
    matching pending invite (auto-accepted here); raises 403 `not_invited` otherwise.
    """
    memberships = await establish_session(db, claims=claims)
    return _build_me_response(memberships, x_orion_company_id)


@router.get("/login-attempts", response_model=LoginAttemptPage)
async def list_login_attempts_endpoint(
    db: DbSession,
    _user: Annotated[User, Depends(RequirePermission("users.read"))],
    email: Annotated[str | None, Query(max_length=255)] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> LoginAttemptPage:
    """Recent login-gate attempts (success + denied), newest first. Admin/manager only.

    Denied logins (`not_invited`, `unverified_email`, `missing_uid`) leave no other
    trace, so this is the place to see who tried to sign in and why they were blocked.
    Optional `email` filter for a specific address.
    """
    rows, total = await list_login_attempts(db, email=email, limit=limit)
    items = [
        LoginAttemptRead(
            id=row.id,
            created_at=row.created_at,
            email=row.email,
            firebase_uid=row.firebase_uid,
            email_verified=row.email_verified,
            outcome=row.outcome.value,
            company_id=row.company_id,
            detail=row.detail,
        )
        for row in rows
    ]
    return LoginAttemptPage(items=items, total=total)


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
