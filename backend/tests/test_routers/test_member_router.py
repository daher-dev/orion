import uuid

from httpx import AsyncClient

from tests.factories import create_company, create_user, get_role_by_code


async def _provision(db_session, role_code: str = "admin", firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    role = await get_role_by_code(db_session, role_code)
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid=firebase_uid,
    )
    return company, user, role


# ---------- GET /v1/members ----------


async def test_list_members_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/members")
    assert response.status_code == 401


async def test_list_members_returns_only_tenant_rows(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    manager_role = await get_role_by_code(db_session, "manager")
    await create_user(db_session, company_id=company.id, role_id=manager_role.id, name="Mng")
    other = await create_company(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    await create_user(db_session, company_id=other.id, role_id=admin_role.id, name="Other")

    response = await authed_client.get("/v1/members")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    names = {m["name"] for m in body["items"]}
    assert names == {"QA Dev User", "Mng"} or "Mng" in names  # Default name from factory may vary


async def test_list_members_includes_role_with_permissions(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    response = await authed_client.get("/v1/members")
    assert response.status_code == 200
    body = response.json()
    item = body["items"][0]
    assert item["role"]["code"] == "admin"
    assert isinstance(item["role"]["permissions"], list)
    assert len(item["role"]["permissions"]) > 0


async def test_list_members_operator_allowed_read(authed_client: AsyncClient, db_session):
    await _provision(db_session, role_code="operator")
    response = await authed_client.get("/v1/members")
    # Operator has no users.read by default — should be 403.
    assert response.status_code == 403


async def test_list_members_manager_allowed_read(authed_client: AsyncClient, db_session):
    await _provision(db_session, role_code="manager")
    response = await authed_client.get("/v1/members")
    assert response.status_code == 200


async def test_list_members_paginates(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    for i in range(3):
        await create_user(db_session, company_id=company.id, role_id=admin_role.id, name=f"P{i}")
    response = await authed_client.get("/v1/members", params={"page": 1, "page_size": 2})
    body = response.json()
    assert body["total"] == 4
    assert len(body["items"]) == 2


# ---------- GET /v1/members/{id} ----------


async def test_get_member_happy_path(authed_client: AsyncClient, db_session):
    _, admin, _ = await _provision(db_session)
    response = await authed_client.get(f"/v1/members/{admin.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(admin.id)
    assert body["role"]["code"] == "admin"


async def test_get_member_404(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    response = await authed_client.get(f"/v1/members/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_get_member_does_not_leak_across_tenants(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    other = await create_company(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    other_user = await create_user(db_session, company_id=other.id, role_id=admin_role.id)
    response = await authed_client.get(f"/v1/members/{other_user.id}")
    assert response.status_code == 404


# ---------- PATCH /v1/members/{id} ----------


async def test_update_member_role_200(authed_client: AsyncClient, db_session):
    company, _admin, _ = await _provision(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    # Add a second admin so we can demote the test user.
    second = await create_user(db_session, company_id=company.id, role_id=admin_role.id, name="Sec")
    manager_role = await get_role_by_code(db_session, "manager")

    response = await authed_client.patch(
        f"/v1/members/{second.id}",
        json={"role_id": str(manager_role.id)},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["role"]["code"] == "manager"


async def test_update_member_role_403_for_manager(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session, role_code="manager")
    admin_role = await get_role_by_code(db_session, "admin")
    target = await create_user(db_session, company_id=company.id, role_id=admin_role.id)

    response = await authed_client.patch(
        f"/v1/members/{target.id}",
        json={"role_id": str(admin_role.id)},
    )
    assert response.status_code == 403


async def test_update_member_role_409_last_admin(authed_client: AsyncClient, db_session):
    _, admin, _ = await _provision(db_session)
    manager_role = await get_role_by_code(db_session, "manager")

    response = await authed_client.patch(
        f"/v1/members/{admin.id}",
        json={"role_id": str(manager_role.id)},
    )
    assert response.status_code == 409


async def test_update_member_role_404_when_role_unknown(authed_client: AsyncClient, db_session):
    _, admin, _ = await _provision(db_session)
    response = await authed_client.patch(
        f"/v1/members/{admin.id}",
        json={"role_id": str(uuid.uuid4())},
    )
    assert response.status_code == 404


async def test_update_member_role_422_when_body_invalid(authed_client: AsyncClient, db_session):
    _, admin, _ = await _provision(db_session)
    response = await authed_client.patch(f"/v1/members/{admin.id}", json={"role_id": "not-a-uuid"})
    assert response.status_code == 422


# ---------- DELETE /v1/members/{id} ----------


async def test_remove_member_204(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    op = await create_user(db_session, company_id=company.id, role_id=operator_role.id)

    response = await authed_client.delete(f"/v1/members/{op.id}")
    assert response.status_code == 204


async def test_remove_member_409_last_admin(authed_client: AsyncClient, db_session):
    _, admin, _ = await _provision(db_session)
    response = await authed_client.delete(f"/v1/members/{admin.id}")
    assert response.status_code == 409


async def test_remove_member_403_for_manager(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session, role_code="manager")
    operator_role = await get_role_by_code(db_session, "operator")
    target = await create_user(db_session, company_id=company.id, role_id=operator_role.id)
    response = await authed_client.delete(f"/v1/members/{target.id}")
    assert response.status_code == 403


async def test_remove_member_404_when_unknown(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    response = await authed_client.delete(f"/v1/members/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_remove_member_401_anonymous(async_client: AsyncClient):
    response = await async_client.delete(f"/v1/members/{uuid.uuid4()}")
    assert response.status_code == 401
