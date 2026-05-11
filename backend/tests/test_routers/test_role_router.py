import uuid

from httpx import AsyncClient

from tests.factories import create_company, create_user, get_role_by_code


async def _provision(db_session, role_code: str = "admin"):
    company = await create_company(db_session)
    role = await get_role_by_code(db_session, role_code)
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )
    return company, user, role


async def test_list_roles_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/roles")
    assert response.status_code == 401


async def test_list_roles_200_for_admin(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    response = await authed_client.get("/v1/roles")
    assert response.status_code == 200
    body = response.json()
    codes = {r["code"] for r in body}
    assert {"admin", "manager", "operator"}.issubset(codes)


async def test_list_roles_200_for_manager(authed_client: AsyncClient, db_session):
    await _provision(db_session, role_code="manager")
    response = await authed_client.get("/v1/roles")
    assert response.status_code == 200


async def test_list_roles_403_for_operator(authed_client: AsyncClient, db_session):
    await _provision(db_session, role_code="operator")
    response = await authed_client.get("/v1/roles")
    assert response.status_code == 403


async def test_list_roles_includes_permissions(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    response = await authed_client.get("/v1/roles")
    body = response.json()
    admin = next(r for r in body if r["code"] == "admin")
    assert len(admin["permissions"]) > 0
    assert any(p["code"] == "users.write" for p in admin["permissions"])


async def test_get_role_happy_path(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    response = await authed_client.get(f"/v1/roles/{admin_role.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["code"] == "admin"
    assert any(p["code"] == "users.write" for p in body["permissions"])


async def test_get_role_404(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    response = await authed_client.get(f"/v1/roles/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_list_roles_sorted_by_code(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    response = await authed_client.get("/v1/roles")
    codes = [r["code"] for r in response.json()]
    assert codes == sorted(codes)
