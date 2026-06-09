import uuid

import pytest
from sqlmodel import select

from models import AuditLog, ChannelConnection
from models.enums import ChannelStatus, Ecommerce
from services.channel_integration import (
    CHANNEL_CATALOG,
    connect_callback,
    connect_start,
    decode_state,
    disconnect,
    encode_state,
    get_channel,
    list_channels,
    parse_channel,
    trigger_sync,
)
from shared.exceptions import NotFoundError, ValidationError
from tests.factories import create_channel_connection, create_company, create_user


async def _setup(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    return company, user


async def _audits(db_session, *, company_id: uuid.UUID) -> list[AuditLog]:
    result = await db_session.exec(
        select(AuditLog).where(AuditLog.company_id == company_id, AuditLog.resource_type == "integrations")
    )
    return list(result.all())


# ---------- list_channels ----------


async def test_list_returns_full_catalog_as_available_for_fresh_tenant(db_session):
    company, _ = await _setup(db_session)

    result = await list_channels(db_session, company_id=company.id)

    assert result.total == len(CHANNEL_CATALOG)
    assert result.connected == 0
    assert all(item.status == ChannelStatus.AVAILABLE for item in result.items)
    # Catalog channels surface even though no row is persisted.
    channels = {item.channel for item in result.items}
    assert Ecommerce.MERCADO_LIVRE in channels
    # No secrets are ever exposed by the read schema.
    assert all(not hasattr(item, "access_token") for item in result.items)


async def test_list_merges_persisted_connection(db_session):
    company, _ = await _setup(db_session)
    await create_channel_connection(
        db_session,
        company_id=company.id,
        channel=Ecommerce.MERCADO_LIVRE,
        status=ChannelStatus.CONNECTED,
        external_account_id="acct-99",
    )

    result = await list_channels(db_session, company_id=company.id)
    assert result.connected == 1
    ml = next(i for i in result.items if i.channel == Ecommerce.MERCADO_LIVRE)
    assert ml.status == ChannelStatus.CONNECTED
    assert ml.external_account_id == "acct-99"
    assert ml.id is not None


async def test_list_does_not_leak_other_tenants(db_session):
    company_a, _ = await _setup(db_session)
    company_b = await create_company(db_session)
    await create_channel_connection(db_session, company_id=company_b.id, channel=Ecommerce.MERCADO_LIVRE)

    result = await list_channels(db_session, company_id=company_a.id)
    # Company A sees the catalog but none connected.
    assert result.connected == 0


# ---------- state signing ----------


async def test_state_round_trips(db_session):
    cid = uuid.uuid4()
    state = encode_state(company_id=cid, channel=Ecommerce.MERCADO_LIVRE)
    decoded_id, decoded_channel = decode_state(state)
    assert decoded_id == cid
    assert decoded_channel == Ecommerce.MERCADO_LIVRE


async def test_tampered_state_is_rejected(db_session):
    state = encode_state(company_id=uuid.uuid4(), channel=Ecommerce.MERCADO_LIVRE)
    with pytest.raises(ValidationError):
        decode_state(state[:-3] + "AAA")


# ---------- parse_channel ----------


def test_parse_channel_rejects_unknown():
    with pytest.raises(NotFoundError):
        parse_channel("not-a-channel")


def test_parse_channel_rejects_unsupported_catalog_channel():
    # `other` is a valid Ecommerce value but not in the supported catalog.
    with pytest.raises(NotFoundError):
        parse_channel(Ecommerce.OTHER.value)


# ---------- connect_start ----------


async def test_connect_start_returns_deterministic_ml_auth_url_without_network(db_session):
    company, user = await _setup(db_session)

    result = await connect_start(
        db_session,
        company_id=company.id,
        user_id=user.id,
        channel=Ecommerce.MERCADO_LIVRE,
    )
    assert result.authorization_url.startswith("https://auth.mercadolivre.com.br/authorization?")
    assert "state=" in result.authorization_url
    assert "response_type=code" in result.authorization_url
    # State decodes back to this company + channel.
    decoded_id, decoded_channel = decode_state(result.state)
    assert decoded_id == company.id
    assert decoded_channel == Ecommerce.MERCADO_LIVRE
    # No connection row is created on start.
    rows = (await db_session.exec(select(ChannelConnection).where(ChannelConnection.company_id == company.id))).all()
    assert list(rows) == []
    assert any("connect started" in a.message for a in await _audits(db_session, company_id=company.id))


# ---------- connect_callback ----------


async def test_connect_callback_persists_tokens_and_flips_status(db_session):
    company, user = await _setup(db_session)

    read = await connect_callback(
        db_session,
        company_id=company.id,
        user_id=user.id,
        channel=Ecommerce.MERCADO_LIVRE,
        code="auth-code-xyz",
    )
    assert read.status == ChannelStatus.CONNECTED

    row = (
        await db_session.exec(
            select(ChannelConnection).where(
                ChannelConnection.company_id == company.id,
                ChannelConnection.channel == Ecommerce.MERCADO_LIVRE,
            )
        )
    ).first()
    assert row is not None
    assert row.status == ChannelStatus.CONNECTED
    assert row.access_token  # stub token persisted
    assert row.external_account_id
    assert any("connected" in a.message.lower() for a in await _audits(db_session, company_id=company.id))


async def test_connect_callback_is_idempotent_upsert(db_session):
    company, user = await _setup(db_session)
    for _ in range(2):
        await connect_callback(
            db_session,
            company_id=company.id,
            user_id=user.id,
            channel=Ecommerce.MERCADO_LIVRE,
            code="code",
        )
    rows = (
        await db_session.exec(
            select(ChannelConnection).where(
                ChannelConnection.company_id == company.id,
                ChannelConnection.channel == Ecommerce.MERCADO_LIVRE,
            )
        )
    ).all()
    assert len(list(rows)) == 1


# ---------- disconnect ----------


async def test_disconnect_clears_tokens_and_resets_status(db_session):
    company, user = await _setup(db_session)
    await create_channel_connection(
        db_session,
        company_id=company.id,
        channel=Ecommerce.MERCADO_LIVRE,
        status=ChannelStatus.CONNECTED,
        access_token="live-token",
        refresh_token="live-refresh",
    )

    read = await disconnect(
        db_session,
        company_id=company.id,
        user_id=user.id,
        channel=Ecommerce.MERCADO_LIVRE,
    )
    assert read.status == ChannelStatus.AVAILABLE

    row = (await db_session.exec(select(ChannelConnection).where(ChannelConnection.company_id == company.id))).first()
    assert row.status == ChannelStatus.AVAILABLE
    assert row.access_token is None
    assert row.refresh_token is None
    assert any("disconnected" in a.message.lower() for a in await _audits(db_session, company_id=company.id))


async def test_disconnect_unknown_raises_not_found(db_session):
    company, user = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await disconnect(
            db_session,
            company_id=company.id,
            user_id=user.id,
            channel=Ecommerce.SHOPEE,
        )


# ---------- trigger_sync ----------


async def test_sync_stamps_last_sync_and_returns_stub_summary(db_session):
    company, user = await _setup(db_session)
    conn = await create_channel_connection(
        db_session,
        company_id=company.id,
        channel=Ecommerce.MERCADO_LIVRE,
        status=ChannelStatus.CONNECTED,
        last_sync_at=None,
    )

    result = await trigger_sync(
        db_session,
        company_id=company.id,
        user_id=user.id,
        channel=Ecommerce.MERCADO_LIVRE,
    )
    # Guarded provider returns nothing — sync is a stub.
    assert result.imported == 0
    assert result.last_sync_at is not None
    assert result.detail is not None

    await db_session.refresh(conn)
    assert conn.last_sync_at is not None


async def test_sync_requires_connected_channel(db_session):
    company, user = await _setup(db_session)
    await create_channel_connection(
        db_session,
        company_id=company.id,
        channel=Ecommerce.SHOPEE,
        status=ChannelStatus.AVAILABLE,
    )
    with pytest.raises(ValidationError):
        await trigger_sync(
            db_session,
            company_id=company.id,
            user_id=user.id,
            channel=Ecommerce.SHOPEE,
        )


# ---------- get_channel ----------


async def test_get_channel_returns_available_when_unconnected(db_session):
    company, _ = await _setup(db_session)
    read = await get_channel(db_session, company_id=company.id, channel=Ecommerce.SHOPEE)
    assert read.status == ChannelStatus.AVAILABLE
    assert read.id is None
