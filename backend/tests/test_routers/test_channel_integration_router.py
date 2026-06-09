import uuid

from httpx import AsyncClient
from sqlmodel import select

from models import ChannelConnection
from models.enums import ChannelStatus, Ecommerce
from services.channel_integration import encode_state
from tests.factories import (
    create_channel_connection,
    create_company,
    create_user,
    get_role_by_code,
)

_BASE = "/v1/integrations/channels"


# ---------- helpers ----------


async def _seed_admin(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    return company, user


async def _seed_manager(db_session):
    company = await create_company(db_session)
    role = await get_role_by_code(db_session, "manager")
    user = await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="qa-dev-user")
    return company, user


async def _seed_operator(db_session):
    company = await create_company(db_session)
    role = await get_role_by_code(db_session, "operator")
    user = await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="qa-dev-user")
    return company, user


# ---------- auth ----------


async def test_list_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get(_BASE)
    assert response.status_code == 401


async def test_list_forbidden_for_operator(authed_client: AsyncClient, db_session):
    await _seed_operator(db_session)
    response = await authed_client.get(_BASE)
    assert response.status_code == 403


async def test_connect_forbidden_for_manager_write(authed_client: AsyncClient, db_session):
    # Manager has integrations.read but NOT integrations.write.
    await _seed_manager(db_session)
    response = await authed_client.post(f"{_BASE}/mercado_livre/connect")
    assert response.status_code == 403


# ---------- GET / ----------


async def test_list_returns_catalog_for_admin(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get(_BASE)
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    assert body["connected"] == 0
    channels = {item["channel"] for item in body["items"]}
    assert "mercado_livre" in channels
    # Secrets never serialized.
    assert all("access_token" not in item for item in body["items"])


async def test_list_read_allowed_for_manager(authed_client: AsyncClient, db_session):
    await _seed_manager(db_session)
    response = await authed_client.get(_BASE)
    assert response.status_code == 200


async def test_list_reflects_connection(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    await create_channel_connection(
        db_session,
        company_id=company.id,
        channel=Ecommerce.MERCADO_LIVRE,
        status=ChannelStatus.CONNECTED,
    )
    response = await authed_client.get(_BASE)
    body = response.json()
    assert body["connected"] == 1


# ---------- GET /{channel} ----------


async def test_get_channel_returns_available(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get(f"{_BASE}/shopee")
    assert response.status_code == 200
    assert response.json()["status"] == "available"


async def test_get_unknown_channel_returns_404(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get(f"{_BASE}/nope")
    assert response.status_code == 404


# ---------- connect ----------


async def test_connect_returns_auth_url(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post(f"{_BASE}/mercado_livre/connect")
    assert response.status_code == 200
    body = response.json()
    assert body["authorization_url"].startswith("https://auth.mercadolivre.com.br/authorization?")
    assert body["state"]


async def test_connect_unknown_channel_returns_404(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post(f"{_BASE}/nope/connect")
    assert response.status_code == 404


# ---------- callback ----------


async def test_callback_persists_connection(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    state = encode_state(company_id=company.id, channel=Ecommerce.MERCADO_LIVRE)
    response = await authed_client.get(
        f"{_BASE}/mercado_livre/callback",
        params={"code": "auth-code", "state": state},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "connected"

    row = (await db_session.exec(select(ChannelConnection).where(ChannelConnection.company_id == company.id))).first()
    assert row is not None
    assert row.status == ChannelStatus.CONNECTED


async def test_callback_without_state_still_connects(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get(
        f"{_BASE}/mercado_livre/callback",
        params={"code": "auth-code"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "connected"


async def test_callback_rejects_mismatched_state(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    foreign_state = encode_state(company_id=uuid.uuid4(), channel=Ecommerce.MERCADO_LIVRE)
    response = await authed_client.get(
        f"{_BASE}/mercado_livre/callback",
        params={"code": "auth-code", "state": foreign_state},
    )
    assert response.status_code == 422


async def test_callback_propagates_oauth_error(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get(
        f"{_BASE}/mercado_livre/callback",
        params={"error": "access_denied"},
    )
    assert response.status_code == 422


# ---------- disconnect ----------


async def test_disconnect_resets_status(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    await create_channel_connection(
        db_session,
        company_id=company.id,
        channel=Ecommerce.MERCADO_LIVRE,
        status=ChannelStatus.CONNECTED,
        access_token="tok",
    )
    response = await authed_client.post(f"{_BASE}/mercado_livre/disconnect")
    assert response.status_code == 200
    assert response.json()["status"] == "available"


async def test_disconnect_when_not_connected_returns_404(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post(f"{_BASE}/shopee/disconnect")
    assert response.status_code == 404


# ---------- sync ----------


async def test_sync_stamps_last_sync(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    await create_channel_connection(
        db_session,
        company_id=company.id,
        channel=Ecommerce.MERCADO_LIVRE,
        status=ChannelStatus.CONNECTED,
    )
    response = await authed_client.post(f"{_BASE}/mercado_livre/sync")
    assert response.status_code == 200
    body = response.json()
    assert body["imported"] == 0
    assert body["last_sync_at"] is not None


async def test_sync_requires_connected_channel(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post(f"{_BASE}/shopee/sync")
    assert response.status_code == 422


async def test_sync_does_not_leak_other_tenant(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    other = await create_company(db_session)
    await create_channel_connection(
        db_session,
        company_id=other.id,
        channel=Ecommerce.MERCADO_LIVRE,
        status=ChannelStatus.CONNECTED,
    )
    # The authed admin's own company has no ML connection -> 422 (not connected).
    response = await authed_client.post(f"{_BASE}/mercado_livre/sync")
    assert response.status_code == 422
