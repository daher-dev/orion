from httpx import AsyncClient

from tests.factories import create_company, create_user, get_role_by_code


async def _provision_admin(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    user = await create_user(
        db_session,
        company_id=company.id,
        firebase_uid=firebase_uid,
        name="Admin User",
        email="admin@orion.test",
        job=None,
    )
    return company, user


async def _provision_operator(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=operator_role.id,
        firebase_uid=firebase_uid,
        name="Op User",
        email="op@orion.test",
    )
    return company, user


# ---------- GET /v1/users/me ----------


async def test_get_my_user_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/users/me")
    assert response.status_code == 401


async def test_get_my_user_returns_self(authed_client: AsyncClient, db_session):
    _, user = await _provision_admin(db_session)

    response = await authed_client.get("/v1/users/me")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(user.id)
    assert body["name"] == "Admin User"
    assert body["email"] == "admin@orion.test"
    assert body["role"]["code"] == "admin"
    assert body["is_operator"] is False


async def test_get_my_user_works_for_operator(authed_client: AsyncClient, db_session):
    """Profile read should not require any specific permission beyond auth."""
    await _provision_operator(db_session)

    response = await authed_client.get("/v1/users/me")
    assert response.status_code == 200
    assert response.json()["role"]["code"] == "operator"


# ---------- PATCH /v1/users/me ----------


async def test_patch_my_user_requires_auth(async_client: AsyncClient):
    response = await async_client.patch("/v1/users/me", json={"name": "x"})
    assert response.status_code == 401


async def test_patch_my_user_updates_name_and_job(authed_client: AsyncClient, db_session):
    _, user = await _provision_admin(db_session)

    response = await authed_client.patch(
        "/v1/users/me",
        json={"name": "Updated", "job": "Designer"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(user.id)
    assert body["name"] == "Updated"
    assert body["job"] == "Designer"


async def test_patch_my_user_partial(authed_client: AsyncClient, db_session):
    _, _ = await _provision_admin(db_session)

    response = await authed_client.patch("/v1/users/me", json={"job": "Stylist"})
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Admin User"
    assert body["job"] == "Stylist"


async def test_patch_my_user_clears_job_with_empty_string(authed_client: AsyncClient, db_session):
    await _provision_admin(db_session)

    # Set a job first.
    await authed_client.patch("/v1/users/me", json={"job": "Initial"})

    response = await authed_client.patch("/v1/users/me", json={"job": ""})
    assert response.status_code == 200
    assert response.json()["job"] is None


async def test_patch_my_user_422_name_too_long(authed_client: AsyncClient, db_session):
    await _provision_admin(db_session)

    response = await authed_client.patch("/v1/users/me", json={"name": "x" * 121})
    assert response.status_code == 422


async def test_patch_my_user_422_job_too_long(authed_client: AsyncClient, db_session):
    await _provision_admin(db_session)

    response = await authed_client.patch("/v1/users/me", json={"job": "x" * 121})
    assert response.status_code == 422


async def test_patch_my_user_works_for_operator(authed_client: AsyncClient, db_session):
    """Profile edits should not require any specific permission beyond auth."""
    await _provision_operator(db_session)

    response = await authed_client.patch("/v1/users/me", json={"name": "Operator New Name"})
    assert response.status_code == 200
    assert response.json()["name"] == "Operator New Name"
