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


def _company_headers(company_id) -> dict[str, str]:
    return {"X-Orion-Company-Id": str(company_id)}


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


async def test_list_roles_marks_seeded_roles_not_custom(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    body = (await authed_client.get("/v1/roles")).json()
    admin = next(r for r in body if r["code"] == "admin")
    assert admin["is_custom"] is False
    assert admin["company_id"] is None


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


# --- Write surface ------------------------------------------------------------


async def test_create_custom_role(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    response = await authed_client.post(
        "/v1/roles",
        json={
            "code": "sales",
            "name": "Sales",
            "description": "Sales team",
            "permission_codes": ["clients.read", "orders.read"],
        },
        headers=_company_headers(company.id),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["code"] == "sales"
    assert body["is_custom"] is True
    assert body["company_id"] == str(company.id)
    assert {p["code"] for p in body["permissions"]} == {"clients.read", "orders.read"}


async def test_create_role_requires_write_permission(authed_client: AsyncClient, db_session):
    # Manager has roles.read but NOT roles.write.
    company, _, _ = await _provision(db_session, role_code="manager")
    response = await authed_client.post(
        "/v1/roles",
        json={"code": "sales", "name": "Sales"},
        headers=_company_headers(company.id),
    )
    assert response.status_code == 403


async def test_create_role_rejects_reserved_code(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    response = await authed_client.post(
        "/v1/roles",
        json={"code": "admin", "name": "Fake"},
        headers=_company_headers(company.id),
    )
    assert response.status_code == 409


async def test_create_role_rejects_unknown_permission(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    response = await authed_client.post(
        "/v1/roles",
        json={"code": "sales", "name": "Sales", "permission_codes": ["nope.read"]},
        headers=_company_headers(company.id),
    )
    assert response.status_code == 422


async def test_create_role_rejects_invalid_code_format(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    response = await authed_client.post(
        "/v1/roles",
        json={"code": "Sales Team!", "name": "Sales"},
        headers=_company_headers(company.id),
    )
    assert response.status_code == 422


async def test_update_custom_role(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    created = (
        await authed_client.post(
            "/v1/roles",
            json={"code": "sales", "name": "Sales", "permission_codes": ["clients.read"]},
            headers=_company_headers(company.id),
        )
    ).json()
    response = await authed_client.patch(
        f"/v1/roles/{created['id']}",
        json={"name": "Sales Pro", "permission_codes": ["orders.read", "orders.write"]},
        headers=_company_headers(company.id),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Sales Pro"
    assert {p["code"] for p in body["permissions"]} == {"orders.read", "orders.write"}


async def test_update_seeded_role_409(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    admin = await get_role_by_code(db_session, "admin")
    response = await authed_client.patch(
        f"/v1/roles/{admin.id}",
        json={"name": "Hacked"},
        headers=_company_headers(company.id),
    )
    assert response.status_code == 409


async def test_delete_custom_role(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    created = (
        await authed_client.post(
            "/v1/roles",
            json={"code": "sales", "name": "Sales"},
            headers=_company_headers(company.id),
        )
    ).json()
    response = await authed_client.delete(f"/v1/roles/{created['id']}", headers=_company_headers(company.id))
    assert response.status_code == 204
    follow = await authed_client.get(f"/v1/roles/{created['id']}", headers=_company_headers(company.id))
    assert follow.status_code == 404


async def test_delete_seeded_role_409(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    operator = await get_role_by_code(db_session, "operator")
    response = await authed_client.delete(f"/v1/roles/{operator.id}", headers=_company_headers(company.id))
    assert response.status_code == 409


async def test_cannot_modify_other_companys_custom_role(authed_client: AsyncClient, db_session):
    # Provision the caller's company + a separate company that owns a custom role.
    company, _, _ = await _provision(db_session)
    other_company = await create_company(db_session)
    other_user = await create_user(db_session, company_id=other_company.id)
    from schemas.role import RoleCreate
    from services.role import create_role

    other_role = await create_role(
        db_session, other_company.id, other_user.id, RoleCreate(code="sales", name="Other Sales")
    )

    # The caller (in their own company context) cannot see or modify it.
    get_resp = await authed_client.get(f"/v1/roles/{other_role.id}", headers=_company_headers(company.id))
    assert get_resp.status_code == 404
    patch_resp = await authed_client.patch(
        f"/v1/roles/{other_role.id}",
        json={"name": "x"},
        headers=_company_headers(company.id),
    )
    assert patch_resp.status_code == 404
