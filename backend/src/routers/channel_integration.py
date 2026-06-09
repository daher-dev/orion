"""Marketplace channel integration endpoints.

Thin HTTP layer over :mod:`services.channel_integration`. Every route is
tenant-scoped (company resolved from the authenticated user) and permission
guarded (``integrations.read`` / ``integrations.write``).

The OAuth callback is modelled as an authenticated GET for this scaffold: the
caller carries the normal auth + ``X-Orion-Company-Id`` context, and the signed
``state`` is cross-checked against that company so a forged/mismatched state is
rejected. A real browser-redirect callback would resolve the company purely
from the signed state — that path is documented in the service.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import User
from schemas.channel_integration import (
    ChannelListRead,
    ChannelRead,
    ChannelSyncResult,
    ConnectStartRead,
)
from services.channel_integration import (
    connect_callback,
    connect_start,
    decode_state,
    disconnect,
    get_channel,
    list_channels,
    parse_channel,
    trigger_sync,
)
from shared.exceptions import ValidationError

router = APIRouter(
    prefix="/integrations/channels",
    tags=["Integrations"],
    dependencies=[Depends(RequirePermission("integrations.read"))],
)


@router.get("", response_model=ChannelListRead)
async def list_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("integrations.read"))],
) -> ChannelListRead:
    return await list_channels(db, company_id=user.company_id)


@router.get("/{channel}", response_model=ChannelRead)
async def get_endpoint(
    channel: str,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("integrations.read"))],
) -> ChannelRead:
    resolved = parse_channel(channel)
    return await get_channel(db, company_id=user.company_id, channel=resolved)


@router.post("/{channel}/connect", response_model=ConnectStartRead)
async def connect_endpoint(
    channel: str,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("integrations.write"))],
) -> ConnectStartRead:
    resolved = parse_channel(channel)
    return await connect_start(
        db,
        company_id=user.company_id,
        user_id=user.id,
        channel=resolved,
    )


@router.get("/{channel}/callback", response_model=ChannelRead)
async def callback_endpoint(
    channel: str,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("integrations.write"))],
    code: Annotated[str | None, Query()] = None,
    state: Annotated[str | None, Query()] = None,
    error: Annotated[str | None, Query()] = None,
) -> ChannelRead:
    resolved = parse_channel(channel)
    if error:
        raise ValidationError(detail=f"OAuth error from channel: {error}")
    # When a state is supplied, verify it was signed for this exact
    # company + channel (tamper / cross-tenant protection).
    if state is not None:
        state_company_id, state_channel = decode_state(state)
        if state_company_id != user.company_id or state_channel != resolved:
            raise ValidationError(detail="OAuth state does not match the current context")
    return await connect_callback(
        db,
        company_id=user.company_id,
        user_id=user.id,
        channel=resolved,
        code=code,
    )


@router.post("/{channel}/disconnect", response_model=ChannelRead)
async def disconnect_endpoint(
    channel: str,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("integrations.write"))],
) -> ChannelRead:
    resolved = parse_channel(channel)
    return await disconnect(
        db,
        company_id=user.company_id,
        user_id=user.id,
        channel=resolved,
    )


@router.post("/{channel}/sync", response_model=ChannelSyncResult, status_code=status.HTTP_200_OK)
async def sync_endpoint(
    channel: str,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("integrations.write"))],
) -> ChannelSyncResult:
    resolved = parse_channel(channel)
    return await trigger_sync(
        db,
        company_id=user.company_id,
        user_id=user.id,
        channel=resolved,
    )
