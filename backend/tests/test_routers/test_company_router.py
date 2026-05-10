from httpx import AsyncClient

from tests.factories import create_company, create_user, get_role_by_code


async def _provision_admin(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session, name="Admin Co")
    user = await create_user(db_session, company_id=company.id, firebase_uid=firebase_uid)
    return company, user


async def _provision_manager(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session, name="Manager Co")
    manager_role = await get_role_by_code(db_session, "manager")
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=manager_role.id,
        firebase_uid=firebase_uid,
    )
    return company, user


async def _provision_operator(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session, name="Operator Co")
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=operator_role.id,
        firebase_uid=firebase_uid,
    )
    return company, user


# ---------- GET /v1/companies/me ----------


async def test_get_my_company_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/companies/me")
    assert response.status_code == 401


async def test_get_my_company_returns_active_tenant(authed_client: AsyncClient, db_session):
    company, _ = await _provision_admin(db_session)

    response = await authed_client.get("/v1/companies/me")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(company.id)
    assert body["name"] == "Admin Co"
    assert "subdomain" in body
    assert "main_color" in body


async def test_get_my_company_403_for_operator_without_read(authed_client: AsyncClient, db_session):
    """Operator role does not include companies.read."""
    await _provision_operator(db_session)

    response = await authed_client.get("/v1/companies/me")
    assert response.status_code == 403


# ---------- PATCH /v1/companies/me ----------


async def test_patch_my_company_requires_auth(async_client: AsyncClient):
    response = await async_client.patch("/v1/companies/me", json={"name": "x"})
    assert response.status_code == 401


async def test_patch_my_company_200(authed_client: AsyncClient, db_session):
    company, _ = await _provision_admin(db_session)

    response = await authed_client.patch(
        "/v1/companies/me",
        json={"name": "Renamed", "main_color": "#abcdef"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(company.id)
    assert body["name"] == "Renamed"
    assert body["main_color"] == "#abcdef"


async def test_patch_my_company_partial(authed_client: AsyncClient, db_session):
    company, _ = await _provision_admin(db_session)

    response = await authed_client.patch("/v1/companies/me", json={"name": "OnlyName"})
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "OnlyName"
    assert body["main_color"] == company.main_color


async def test_patch_my_company_422_invalid_color(authed_client: AsyncClient, db_session):
    await _provision_admin(db_session)

    response = await authed_client.patch("/v1/companies/me", json={"main_color": "red"})
    assert response.status_code == 422


async def test_patch_my_company_422_name_too_long(authed_client: AsyncClient, db_session):
    await _provision_admin(db_session)

    response = await authed_client.patch("/v1/companies/me", json={"name": "x" * 121})
    assert response.status_code == 422


async def test_patch_my_company_403_for_manager(authed_client: AsyncClient, db_session):
    """Manager role has companies.read but not companies.write."""
    await _provision_manager(db_session)

    response = await authed_client.patch("/v1/companies/me", json={"name": "x"})
    assert response.status_code == 403


async def test_patch_my_company_403_for_operator(authed_client: AsyncClient, db_session):
    await _provision_operator(db_session)

    response = await authed_client.patch("/v1/companies/me", json={"name": "x"})
    assert response.status_code == 403
