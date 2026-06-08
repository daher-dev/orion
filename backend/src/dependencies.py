import uuid
from typing import Annotated

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from config import config
from database import get_db
from models import Company, Role, User
from shared.exceptions import AuthenticationError, AuthorizationError, NotFoundError

security = HTTPBearer(auto_error=False)

# Path prefixes that operate without a fully provisioned User row
# (e.g. accepting an invite by token before the User row exists).
_UNAUTH_USER_PATH_PREFIXES: tuple[str, ...] = ("/v1/auth/invites/",)


async def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> dict:
    """Verify Firebase ID token and return decoded token claims.

    In non-prod environments, an `X-Dev-Bypass-Uid` header short-circuits Firebase
    verification so local dev and automated tests don't require live Firebase auth.
    """
    if credentials is None:
        dev_uid = request.headers.get("X-Dev-Bypass-Uid")
        if config.ENV != "prd" and dev_uid:
            return {
                "uid": dev_uid,
                "name": request.headers.get("X-Dev-Bypass-Name", "Orion Dev"),
                "email": request.headers.get("X-Dev-Bypass-Email", "dev@orion.local"),
                "email_verified": True,
                "picture": request.headers.get("X-Dev-Bypass-Picture"),
            }
        raise AuthenticationError(detail="Missing authentication token")

    try:
        decoded_token = auth.verify_id_token(id_token=credentials.credentials)
    except Exception as exc:
        raise AuthenticationError(detail="Invalid or expired token") from exc
    return decoded_token


CurrentClaims = Annotated[dict, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_db_user(
    request: Request,
    claims: CurrentClaims,
    db: DbSession,
    x_orion_company_id: Annotated[
        uuid.UUID | None,
        Header(alias="X-Orion-Company-Id", convert_underscores=False),
    ] = None,
) -> User:
    """Resolve the active `User` row for the authenticated Firebase identity.

    A single Firebase identity may have multiple `User` rows (one per company).
    The optional `X-Orion-Company-Id` header selects which company context applies;
    otherwise the oldest membership is used as a deterministic default.
    """
    firebase_uid = claims.get("uid")
    if not firebase_uid:
        raise AuthenticationError(detail="Missing user identifier")

    base_stmt = (
        select(User)
        .where(User.firebase_uid == firebase_uid)
        .options(selectinload(User.role).selectinload(Role.permissions))
        .order_by(User.created_at.asc())  # type: ignore[attr-defined]
    )

    user: User | None = None
    if x_orion_company_id is not None:
        scoped_stmt = base_stmt.where(User.company_id == x_orion_company_id)
        user = (await db.exec(scoped_stmt)).first()

    # No membership in the requested company. If the identity is a platform
    # operator, grant an impersonation context for that company (real support
    # session): a transient admin-scoped User bound to the target company. Every
    # tenant endpoint then operates inside that company with full permissions,
    # while audit entries still reference the operator's real user id.
    if user is None and x_orion_company_id is not None:
        base_user = (await db.exec(base_stmt)).first()
        if base_user is not None and base_user.is_operator:
            impersonated = await _impersonation_user(db, base_user, x_orion_company_id, request)
            # A missing target company (e.g. a stale localStorage id) falls through
            # to the operator's own membership rather than 404-ing the request.
            if impersonated is not None:
                return impersonated

    # If the requested company header didn't match (e.g. localStorage still
    # carries an id from a previous tenant before a re-seed), or no header was
    # sent, fall back to the user's first membership. This keeps the app
    # usable after dev seeds without forcing the user to clear localStorage.
    if user is None:
        user = (await db.exec(base_stmt)).first()

    if user is None:
        # Allow onboarding/invite flows where no User row exists yet.
        if request.url.path.startswith(_UNAUTH_USER_PATH_PREFIXES):
            raise AuthenticationError(detail="User not provisioned")
        raise AuthenticationError(detail="User not found for the provided identity")

    return user


CurrentDbUser = Annotated[User, Depends(get_current_db_user)]

_ADMIN_ROLE_CODE = "admin"


async def _impersonation_user(
    db: AsyncSession,
    operator: User,
    company_id: uuid.UUID,
    request: Request,
) -> User | None:
    """Build a transient admin-scoped `User` for an operator impersonating a company.

    The returned row is never added to the session: it carries the operator's real
    `id` (so `AuditLog.user_id` stays a valid FK) but the target `company_id` and the
    global admin role, granting full tenant access for the support session. Returns
    None when the target company doesn't exist so the caller can fall back to the
    operator's own membership (e.g. a stale localStorage company id).
    """
    company = (await db.exec(select(Company).where(Company.id == company_id))).first()
    if company is None:
        return None

    admin_role = (
        await db.exec(select(Role).where(Role.code == _ADMIN_ROLE_CODE).options(selectinload(Role.permissions)))
    ).first()
    if admin_role is None:  # pragma: no cover — seeded by migration
        raise NotFoundError(detail="Admin role not seeded")

    request.state.impersonating = True
    request.state.impersonated_company_id = company_id

    impersonated = User(
        firebase_uid=operator.firebase_uid,
        name=operator.name,
        email=operator.email,
        is_operator=True,
        company_id=company_id,
        role_id=admin_role.id,
    )
    impersonated.id = operator.id
    impersonated.role = admin_role
    return impersonated


async def get_operator_user(user: CurrentDbUser) -> User:
    """Dependency: require the caller to be a platform operator (Console access)."""
    if not user.is_operator:
        raise AuthorizationError(detail="Operator access required")
    return user


CurrentOperator = Annotated[User, Depends(get_operator_user)]


def RequirePermission(*codes: str):  # noqa: N802 — FastAPI dependency factory convention
    """Dependency factory: enforces the user has every permission code in `codes`."""

    required = frozenset(codes)

    async def _checker(user: CurrentDbUser) -> User:
        granted = {perm.code for perm in (user.role.permissions if user.role else [])}
        missing = sorted(required - granted)
        if missing:
            raise AuthorizationError(detail=f"Missing permissions: {', '.join(missing)}")
        return user

    return _checker
