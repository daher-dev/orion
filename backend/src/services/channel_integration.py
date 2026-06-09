"""Tenant-scoped marketplace channel integration service.

Responsibilities
----------------
- ``list_channels``: merge the fixed channel CATALOG with the tenant's persisted
  :class:`~models.channel_integration.ChannelConnection` rows so supported but
  not-yet-connected channels surface as ``available``.
- ``connect_start``: produce a deterministic, network-free OAuth authorization
  URL and a signed ``state`` carrying the company+channel context (so the
  browser-redirected callback can resolve the tenant without an auth header).
- ``connect_callback``: exchange the code for tokens (stubbed/guarded), persist
  the connection, flip status to ``connected``, and audit.
- ``disconnect``: clear tokens, set status back to ``available``, and audit.
- ``trigger_sync``: stamp ``last_sync_at`` and return a stub summary. The real
  order feed is guarded by config and never hits the network in dev/tests.

All mutations are tenant-scoped (``company_id``) and audited via ``write_audit``.
Stored OAuth tokens are NEVER returned to the caller's read schema.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from config import config
from models import ChannelConnection
from models.enums import ChannelStatus, Ecommerce
from schemas.channel_integration import (
    ChannelListRead,
    ChannelRead,
    ChannelSyncResult,
    ConnectStartRead,
)
from services._audit import write_audit
from services._base import scoped
from services.channels.providers import get_provider
from shared.exceptions import NotFoundError, ValidationError

_RESOURCE = "integrations"


@dataclass(frozen=True)
class ChannelSpec:
    """Static display metadata for a supported channel (mirrors settings.jsx)."""

    channel: Ecommerce
    label: str
    description: str
    group: str
    color: str
    fg: str


# Fixed catalog of supported channels. Colors mirror docs/design/pages/settings.jsx
# so the settings pane renders with brand parity.
CHANNEL_CATALOG: tuple[ChannelSpec, ...] = (
    ChannelSpec(
        channel=Ecommerce.MERCADO_LIVRE,
        label="Mercado Livre",
        description="Marketplace — pedidos e anúncios",
        group="Marketplaces",
        color="#fff159",
        fg="#1f1f1f",
    ),
    ChannelSpec(
        channel=Ecommerce.SHOPEE,
        label="Shopee",
        description="Marketplace — pedidos e anúncios",
        group="Marketplaces",
        color="#ee4d2d",
        fg="#ffffff",
    ),
    ChannelSpec(
        channel=Ecommerce.SHOPIFY,
        label="Shopify",
        description="Loja própria — pedidos",
        group="Marketplaces",
        color="#95bf47",
        fg="#ffffff",
    ),
    ChannelSpec(
        channel=Ecommerce.INSTAGRAM,
        label="Instagram",
        description="Comunicação — mensagens e vendas sociais",
        group="Comunicação",
        color="#e1306c",
        fg="#ffffff",
    ),
    ChannelSpec(
        channel=Ecommerce.WHATSAPP,
        label="WhatsApp",
        description="Comunicação — atendimento e vendas",
        group="Comunicação",
        color="#25d366",
        fg="#ffffff",
    ),
)

_CATALOG_BY_CHANNEL: dict[Ecommerce, ChannelSpec] = {spec.channel: spec for spec in CHANNEL_CATALOG}

_STATE_SEP = "."


def _signing_key() -> bytes:
    """Deterministic HMAC key for signing OAuth ``state``.

    Derived from stable config so the same process can validate what it signed.
    This is a scaffold-grade secret — a dedicated SECRET_KEY should back the
    real OAuth flow in production.
    """
    material = f"{config.APP_NAME}:{config.FIREBASE_PROJECT_ID}:channel-oauth-state".encode()
    return hashlib.sha256(material).digest()


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def encode_state(*, company_id: uuid.UUID, channel: Ecommerce) -> str:
    """Sign ``company_id:channel`` into an opaque, tamper-evident state token."""
    payload = f"{company_id}:{channel.value}".encode()
    sig = hmac.new(_signing_key(), payload, hashlib.sha256).digest()
    return f"{_b64(payload)}{_STATE_SEP}{_b64(sig)}"


def decode_state(state: str) -> tuple[uuid.UUID, Ecommerce]:
    """Verify and decode a signed state token. Raises ValidationError if invalid."""
    try:
        payload_b64, sig_b64 = state.split(_STATE_SEP, 1)
        payload = _b64decode(payload_b64)
        expected = hmac.new(_signing_key(), payload, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64decode(sig_b64)):
            raise ValueError("signature mismatch")
        company_str, channel_str = payload.decode().split(":", 1)
        return uuid.UUID(company_str), Ecommerce(channel_str)
    except (ValueError, KeyError) as exc:
        raise ValidationError(detail="Invalid OAuth state") from exc


def parse_channel(value: str) -> Ecommerce:
    """Resolve a path ``channel`` slug to a supported catalog channel.

    Raises NotFoundError for unknown or unsupported (non-catalog) channels.
    """
    try:
        channel = Ecommerce(value)
    except ValueError as exc:
        raise NotFoundError(detail="Unknown channel") from exc
    if channel not in _CATALOG_BY_CHANNEL:
        raise NotFoundError(detail="Unsupported channel")
    return channel


def _to_read(spec: ChannelSpec, conn: ChannelConnection | None) -> ChannelRead:
    if conn is None:
        return ChannelRead(
            channel=spec.channel,
            label=spec.label,
            description=spec.description,
            group=spec.group,
            color=spec.color,
            fg=spec.fg,
            status=ChannelStatus.AVAILABLE,
        )
    return ChannelRead(
        channel=spec.channel,
        label=spec.label,
        description=spec.description,
        group=spec.group,
        color=spec.color,
        fg=spec.fg,
        status=conn.status,
        id=conn.id,
        external_account_id=conn.external_account_id,
        last_sync_at=conn.last_sync_at,
        token_expires_at=conn.token_expires_at,
        created_at=conn.created_at,
        updated_at=conn.updated_at,
    )


async def _connections_by_channel(db: AsyncSession, *, company_id: uuid.UUID) -> dict[Ecommerce, ChannelConnection]:
    stmt = scoped(select(ChannelConnection), ChannelConnection, company_id)
    rows = (await db.exec(stmt)).all()
    return {row.channel: row for row in rows}


async def _get_connection(db: AsyncSession, *, company_id: uuid.UUID, channel: Ecommerce) -> ChannelConnection | None:
    stmt = scoped(select(ChannelConnection), ChannelConnection, company_id).where(ChannelConnection.channel == channel)
    return (await db.exec(stmt)).first()


async def list_channels(db: AsyncSession, *, company_id: uuid.UUID) -> ChannelListRead:
    """Catalog merged with the tenant's persisted connections."""
    existing = await _connections_by_channel(db, company_id=company_id)
    items = [_to_read(spec, existing.get(spec.channel)) for spec in CHANNEL_CATALOG]
    connected = sum(1 for item in items if item.status == ChannelStatus.CONNECTED)
    return ChannelListRead(items=items, connected=connected, total=len(items))


async def get_channel(db: AsyncSession, *, company_id: uuid.UUID, channel: Ecommerce) -> ChannelRead:
    spec = _CATALOG_BY_CHANNEL[channel]
    conn = await _get_connection(db, company_id=company_id, channel=channel)
    return _to_read(spec, conn)


async def connect_start(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    channel: Ecommerce,
) -> ConnectStartRead:
    """Produce the OAuth authorization URL + signed state for a channel.

    Network-free: the provider's ``build_auth_url`` is a pure string builder.
    A pending ``ChannelConnection`` row is NOT created here — it is persisted on
    the callback. The signed state carries the company+channel context.
    """
    provider = get_provider(channel)
    state = encode_state(company_id=company_id, channel=channel)
    authorization_url = provider.build_auth_url(state=state)

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_id=company_id,
        resource_type=_RESOURCE,
        message=f"Channel connect started: {channel.value}",
    )
    await db.commit()
    return ConnectStartRead(authorization_url=authorization_url, state=state, connected=False)


async def connect_callback(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    channel: Ecommerce,
    code: str | None,
) -> ChannelRead:
    """Finalize an OAuth connect: exchange the code, persist tokens, audit.

    The token exchange is guarded — in dev/tests it returns placeholder tokens
    and performs no network I/O. Upserts the (company, channel) connection.
    """
    provider = get_provider(channel)
    tokens = await provider.exchange_code(code=code)

    conn = await _get_connection(db, company_id=company_id, channel=channel)
    if conn is None:
        conn = ChannelConnection(company_id=company_id, channel=channel)
        db.add(conn)

    conn.status = ChannelStatus.CONNECTED
    conn.access_token = tokens.access_token
    conn.refresh_token = tokens.refresh_token
    conn.token_expires_at = tokens.expires_at
    conn.external_account_id = tokens.external_account_id
    conn.scopes = tokens.scopes
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_id=conn.id,
        resource_type=_RESOURCE,
        message=f"Channel connected: {channel.value}",
    )
    await db.commit()
    await db.refresh(conn)
    return _to_read(_CATALOG_BY_CHANNEL[channel], conn)


async def disconnect(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    channel: Ecommerce,
) -> ChannelRead:
    """Clear stored tokens and set the channel back to ``available``."""
    conn = await _get_connection(db, company_id=company_id, channel=channel)
    if conn is None:
        raise NotFoundError(detail="Channel is not connected")

    conn.status = ChannelStatus.AVAILABLE
    conn.access_token = None
    conn.refresh_token = None
    conn.token_expires_at = None
    conn.external_account_id = None
    conn.scopes = None
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_id=conn.id,
        resource_type=_RESOURCE,
        message=f"Channel disconnected: {channel.value}",
    )
    await db.commit()
    await db.refresh(conn)
    return _to_read(_CATALOG_BY_CHANNEL[channel], conn)


async def trigger_sync(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    channel: Ecommerce,
) -> ChannelSyncResult:
    """Manually trigger a sync for a connected channel.

    Reuses the orders-import pipeline conceptually but, without a live feed
    wired up, only stamps ``last_sync_at`` and returns a zero summary. The
    provider order fetch is guarded by config and never hits the network in
    dev/tests (returns an empty list).
    """
    conn = await _get_connection(db, company_id=company_id, channel=channel)
    if conn is None or conn.status != ChannelStatus.CONNECTED:
        raise ValidationError(detail="Channel must be connected before syncing")

    provider = get_provider(channel)
    fetched = await provider.fetch_orders(access_token=conn.access_token)

    now = datetime.now(UTC)
    conn.last_sync_at = now
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_id=conn.id,
        resource_type=_RESOURCE,
        message=f"Channel sync triggered: {channel.value} ({len(fetched)} fetched)",
    )
    await db.commit()

    detail = None if fetched else "No live feed configured; sync is a stub."
    return ChannelSyncResult(
        channel=channel,
        last_sync_at=now,
        imported=0,
        skipped=len(fetched),
        detail=detail,
    )
