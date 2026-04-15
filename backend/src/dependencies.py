from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth
from sqlmodel.ext.asyncio.session import AsyncSession

from config import config
from database import get_db
from shared.exceptions import AuthenticationError

security = HTTPBearer(auto_error=False)


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


CurrentUser = Annotated[dict, Depends(get_current_user)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
