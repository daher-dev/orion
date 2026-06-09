"""Schemas for the marketplace channel integration feature.

The read schema deliberately OMITS ``access_token`` / ``refresh_token`` so
stored credentials never reach the browser. It merges catalog display metadata
(label, color, group) with the persisted connection state so the settings pane
can render both connected and not-yet-connected ("available") channels.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from models.enums import ChannelStatus, Ecommerce


class ChannelRead(BaseModel):
    """One channel as seen by the tenant — catalog metadata + connection state.

    ``id`` is the persisted connection id when a row exists, else None (the
    channel is in the catalog but the tenant has never connected it).
    """

    channel: Ecommerce
    label: str
    description: str
    group: str
    color: str
    fg: str
    status: ChannelStatus
    id: uuid.UUID | None = None
    external_account_id: str | None = None
    last_sync_at: datetime | None = None
    token_expires_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ChannelListRead(BaseModel):
    """The full channel catalog merged with the tenant's connections."""

    items: list[ChannelRead]
    connected: int = Field(ge=0)
    total: int = Field(ge=0)


class ConnectStartRead(BaseModel):
    """Response of ``POST /connect`` — the OAuth-style authorization URL.

    The frontend redirects the user to ``authorization_url``. ``state`` carries
    the signed company+channel context so the callback can resolve the tenant
    without an auth header. ``connected`` is True when the provider is a stub
    (no real OAuth configured): the connection is finalized immediately and no
    redirect is needed.
    """

    authorization_url: str
    state: str
    connected: bool = False


class ChannelSyncResult(BaseModel):
    """Outcome of a manual sync trigger.

    The sync reuses the orders-import pipeline conceptually but, without a live
    feed wired up, only stamps ``last_sync_at`` and reports a zero summary.
    """

    channel: Ecommerce
    last_sync_at: datetime
    imported: int = Field(default=0, ge=0)
    skipped: int = Field(default=0, ge=0)
    detail: str | None = None


class ChannelCallbackQuery(BaseModel):
    """Query params accepted by the OAuth callback endpoint."""

    code: str | None = None
    state: str | None = None
    error: str | None = None


__all__ = [
    "ChannelCallbackQuery",
    "ChannelListRead",
    "ChannelRead",
    "ChannelSyncResult",
    "ConnectStartRead",
]
