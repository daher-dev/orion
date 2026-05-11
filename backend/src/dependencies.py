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
from models import Role, User
from shared.exceptions import AuthenticationError, AuthorizationError

security = HTTPBearer(auto_error=False)

# Path prefixes that operate without a fully provisioned User row
# (e.g. first-time onboarding, accepting an invite).
_UNAUTH_USER_PATH_PREFIXES: tuple[str, ...] = (
    "/v1/auth/onboarding",
    "/v1/auth/invites/",
)


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
