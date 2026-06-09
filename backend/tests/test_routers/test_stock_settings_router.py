"""HTTP integration tests for the stock-settings endpoints.

Covers GET/PUT happy paths, the default for a fresh company, validation, and
permission gating (a role lacking stock.write is forbidden from PUT but an
operator — who holds stock.write — is allowed).
"""

import uuid

from httpx import AsyncClient

from models import Role
from tests.factories import (
    create_company,
    create_user,
    get_role_by_code,
)


async def _seed_admin(db_session, **company_overrides):
    company = await create_company(db_session, **company_overrides)
    user = await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    return company, user


async def _seed_operator(db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=operator_role.id,
        firebase_uid="qa-dev-user",
    )
    return company, user


# ---------- auth ----------


async def test_get_settings_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/stock/settings")
    assert response.status_code == 401


async def test_put_settings_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.put("/v1/stock/settings", json={"low_stock_threshold": 5})
    assert response.status_code == 401


# ---------- GET /stock/settings ----------


async def test_get_settings_returns_default_for_fresh_company(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get("/v1/stock/settings")
    assert response.status_code == 200
    assert response.json()["low_stock_threshold"] == 10


async def test_get_settings_returns_configured_value(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session, low_stock_threshold=3)
    response = await authed_client.get("/v1/stock/settings")
    assert response.status_code == 200
    assert response.json()["low_stock_threshold"] == 3


# ---------- PUT /stock/settings ----------


async def test_put_settings_updates_value(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.put("/v1/stock/settings", json={"low_stock_threshold": 42})
    assert response.status_code == 200
    assert response.json()["low_stock_threshold"] == 42

    # Read-back reflects the new value.
    get_response = await authed_client.get("/v1/stock/settings")
    assert get_response.json()["low_stock_threshold"] == 42


async def test_put_settings_rejects_negative(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.put("/v1/stock/settings", json={"low_stock_threshold": -1})
    assert response.status_code == 422


async def test_operator_can_update_settings(authed_client: AsyncClient, db_session):
    """Operators hold stock.write — they must be able to configure the threshold."""
    await _seed_operator(db_session)
    response = await authed_client.put("/v1/stock/settings", json={"low_stock_threshold": 6})
    assert response.status_code == 200
    assert response.json()["low_stock_threshold"] == 6


async def test_put_settings_forbidden_when_no_stock_write(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    role = Role(code=f"custom-no-stock-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )
    response = await authed_client.put("/v1/stock/settings", json={"low_stock_threshold": 5})
    assert response.status_code == 403


async def test_get_settings_tenant_isolation(authed_client: AsyncClient, db_session):
    # Authed admin's own company has threshold 3; a sibling has 99.
    await _seed_admin(db_session, low_stock_threshold=3)
    await create_company(db_session, low_stock_threshold=99)
    response = await authed_client.get("/v1/stock/settings")
    assert response.json()["low_stock_threshold"] == 3
