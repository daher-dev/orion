import uuid

from httpx import AsyncClient

from tests.factories import (
    create_client as factory_create_client,
)
from tests.factories import (
    create_company,
    create_user,
    get_role_by_code,
)


async def _provision_manager(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid=firebase_uid)
    return company, user


async def _provision_operator(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=operator_role.id,
        firebase_uid=firebase_uid,
    )
    return company, user


# ---------- GET /v1/clients ----------


async def test_list_clients_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/clients")
    assert response.status_code == 401


async def test_list_clients_returns_only_tenant_rows(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    other = await create_company(db_session)
    await factory_create_client(db_session, company_id=company.id, name="Mine")
    await factory_create_client(db_session, company_id=other.id, name="Theirs")

    response = await authed_client.get("/v1/clients")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Mine"


async def test_list_clients_filters_by_query(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    await factory_create_client(db_session, company_id=company.id, name="Mariana")
    await factory_create_client(db_session, company_id=company.id, name="Felipe")

    response = await authed_client.get("/v1/clients", params={"q": "mari"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Mariana"


async def test_list_clients_paginates(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    for i in range(3):
        await factory_create_client(db_session, company_id=company.id, name=f"C{i}")

    response = await authed_client.get("/v1/clients", params={"page": 1, "page_size": 2})
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["has_more"] is True


async def test_list_clients_rejects_unknown_user(authed_client: AsyncClient, db_session):
    """No User row for the dev-bypass UID — backend returns 401."""
    await create_company(db_session)
    response = await authed_client.get("/v1/clients")
    assert response.status_code == 401


# ---------- GET /v1/clients/{id} ----------


async def test_get_client_detail(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    client = await factory_create_client(db_session, company_id=company.id, name="Detail")

    response = await authed_client.get(f"/v1/clients/{client.id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Detail"


async def test_get_client_404_when_unknown(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.get(f"/v1/clients/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_get_client_404_when_other_tenant(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    other = await create_company(db_session)
    other_client = await factory_create_client(db_session, company_id=other.id)

    response = await authed_client.get(f"/v1/clients/{other_client.id}")
    assert response.status_code == 404


# ---------- POST /v1/clients ----------


async def test_create_client_201(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)

    response = await authed_client.post(
        "/v1/clients",
        json={
            "name": "New Client",
            "email": "new@example.com",
            "phone": "11 99999-0000",
            "address": "Rua X, 100",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "New Client"
    assert body["email"] == "new@example.com"


async def test_create_client_422_when_name_missing(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)

    response = await authed_client.post("/v1/clients", json={"email": "x@example.com"})
    assert response.status_code == 422


async def test_create_client_422_when_email_invalid(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)

    response = await authed_client.post("/v1/clients", json={"name": "X", "email": "not-an-email"})
    assert response.status_code == 422


async def test_create_client_403_for_operator(authed_client: AsyncClient, db_session):
    await _provision_operator(db_session)

    response = await authed_client.post("/v1/clients", json={"name": "X"})
    assert response.status_code == 403


async def test_create_client_401_anonymous(async_client: AsyncClient):
    response = await async_client.post("/v1/clients", json={"name": "X"})
    assert response.status_code == 401


# ---------- PATCH /v1/clients/{id} ----------


async def test_update_client_200(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    client = await factory_create_client(db_session, company_id=company.id, name="Old")

    response = await authed_client.patch(
        f"/v1/clients/{client.id}",
        json={"name": "New"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "New"


async def test_update_client_404_when_unknown(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.patch(f"/v1/clients/{uuid.uuid4()}", json={"name": "X"})
    assert response.status_code == 404


async def test_update_client_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    client = await factory_create_client(db_session, company_id=company.id)

    response = await authed_client.patch(f"/v1/clients/{client.id}", json={"name": "X"})
    assert response.status_code == 403


async def test_update_client_422_invalid_email(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    client = await factory_create_client(db_session, company_id=company.id)

    response = await authed_client.patch(f"/v1/clients/{client.id}", json={"email": "no-at-sign"})
    assert response.status_code == 422


async def test_update_client_401_anonymous(async_client: AsyncClient, db_session):
    company = await create_company(db_session)
    client = await factory_create_client(db_session, company_id=company.id)

    response = await async_client.patch(f"/v1/clients/{client.id}", json={"name": "X"})
    assert response.status_code == 401


# ---------- DELETE /v1/clients/{id} ----------


async def test_delete_client_204(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    client = await factory_create_client(db_session, company_id=company.id)

    response = await authed_client.delete(f"/v1/clients/{client.id}")
    assert response.status_code == 204


async def test_delete_client_404_when_unknown(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.delete(f"/v1/clients/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_delete_client_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    client = await factory_create_client(db_session, company_id=company.id)

    response = await authed_client.delete(f"/v1/clients/{client.id}")
    assert response.status_code == 403


async def test_delete_client_401_anonymous(async_client: AsyncClient, db_session):
    company = await create_company(db_session)
    client = await factory_create_client(db_session, company_id=company.id)

    response = await async_client.delete(f"/v1/clients/{client.id}")
    assert response.status_code == 401
