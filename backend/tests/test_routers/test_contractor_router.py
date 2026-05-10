import uuid

from httpx import AsyncClient
from sqlmodel import select

from models import SewingContractor
from tests.factories import (
    create_company,
    create_sewing_contractor,
    create_user,
    get_role_by_code,
)

# ---------- helpers ----------


async def _seed_admin(db_session):
    company = await create_company(db_session)
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


async def test_list_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/contractors")
    assert response.status_code == 401


async def test_create_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.post("/v1/contractors", json={"name": "X"})
    assert response.status_code == 401


# ---------- GET / ----------


async def test_list_returns_empty_page_for_new_tenant(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)

    response = await authed_client.get("/v1/contractors")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0
    assert body["page"] == 1
    assert body["has_more"] is False


async def test_list_returns_tenant_rows(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    await create_sewing_contractor(db_session, company_id=company.id, name="Banca A")
    await create_sewing_contractor(db_session, company_id=company.id, name="Banca B")

    response = await authed_client.get("/v1/contractors")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    names = {item["name"] for item in body["items"]}
    assert names == {"Banca A", "Banca B"}


async def test_list_supports_search_query(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    await create_sewing_contractor(db_session, company_id=company.id, name="Banca Esperança")
    await create_sewing_contractor(db_session, company_id=company.id, name="Banca Lucia", phone="91234")

    response = await authed_client.get("/v1/contractors", params={"q": "esperan"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Banca Esperança"


async def test_list_supports_pagination(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    for i in range(3):
        await create_sewing_contractor(db_session, company_id=company.id, name=f"Banca {i}")

    response = await authed_client.get("/v1/contractors", params={"page_size": 2})
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["has_more"] is True


async def test_list_does_not_leak_other_tenants(authed_client: AsyncClient, db_session):
    company_a, _ = await _seed_admin(db_session)
    company_b = await create_company(db_session)
    await create_sewing_contractor(db_session, company_id=company_a.id, name="Mine")
    await create_sewing_contractor(db_session, company_id=company_b.id, name="Theirs")

    response = await authed_client.get("/v1/contractors")
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Mine"


async def test_list_forbidden_for_user_without_permission(authed_client: AsyncClient, db_session):
    await _seed_operator(db_session)
    response = await authed_client.get("/v1/contractors")
    assert response.status_code == 403


# ---------- GET /{id} ----------


async def test_get_returns_contractor(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    seed = await create_sewing_contractor(db_session, company_id=company.id, name="Detail")

    response = await authed_client.get(f"/v1/contractors/{seed.id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Detail"


async def test_get_returns_404_when_unknown(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get(f"/v1/contractors/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_get_returns_404_for_other_tenant_row(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    other = await create_company(db_session)
    foreign = await create_sewing_contractor(db_session, company_id=other.id, name="Other")

    response = await authed_client.get(f"/v1/contractors/{foreign.id}")
    assert response.status_code == 404


# ---------- POST / ----------


async def test_create_success(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    payload = {"name": "Banca New", "address": "rua A", "phone": "9999"}
    response = await authed_client.post("/v1/contractors", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Banca New"
    assert body["address"] == "rua A"
    assert body["phone"] == "9999"

    rows = (await db_session.exec(select(SewingContractor).where(SewingContractor.company_id == company.id))).all()
    assert len(list(rows)) == 1


async def test_create_returns_409_on_duplicate_name(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    await create_sewing_contractor(db_session, company_id=company.id, name="Dupe")
    response = await authed_client.post("/v1/contractors", json={"name": "Dupe"})
    assert response.status_code == 409


async def test_create_returns_422_for_empty_name(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post("/v1/contractors", json={"name": ""})
    assert response.status_code == 422


async def test_create_forbidden_for_operator(authed_client: AsyncClient, db_session):
    await _seed_operator(db_session)
    response = await authed_client.post("/v1/contractors", json={"name": "Banca"})
    assert response.status_code == 403


# ---------- PATCH /{id} ----------


async def test_patch_updates_fields(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    seed = await create_sewing_contractor(db_session, company_id=company.id, name="Original")

    response = await authed_client.patch(
        f"/v1/contractors/{seed.id}",
        json={"name": "Renamed", "phone": "1234"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Renamed"
    assert body["phone"] == "1234"


async def test_patch_returns_404_when_unknown(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.patch(
        f"/v1/contractors/{uuid.uuid4()}",
        json={"name": "Y"},
    )
    assert response.status_code == 404


async def test_patch_returns_409_on_duplicate(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    await create_sewing_contractor(db_session, company_id=company.id, name="Taken")
    other = await create_sewing_contractor(db_session, company_id=company.id, name="Other")

    response = await authed_client.patch(
        f"/v1/contractors/{other.id}",
        json={"name": "Taken"},
    )
    assert response.status_code == 409


async def test_patch_forbidden_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _seed_operator(db_session)
    seed = await create_sewing_contractor(db_session, company_id=company.id, name="X")

    response = await authed_client.patch(f"/v1/contractors/{seed.id}", json={"name": "Y"})
    assert response.status_code == 403


# ---------- DELETE /{id} ----------


async def test_delete_returns_204(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    seed = await create_sewing_contractor(db_session, company_id=company.id, name="Bye")

    response = await authed_client.delete(f"/v1/contractors/{seed.id}")
    assert response.status_code == 204

    rows = (await db_session.exec(select(SewingContractor).where(SewingContractor.id == seed.id))).all()
    assert list(rows) == []


async def test_delete_returns_404_when_unknown(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.delete(f"/v1/contractors/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_delete_forbidden_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _seed_operator(db_session)
    seed = await create_sewing_contractor(db_session, company_id=company.id, name="X")

    response = await authed_client.delete(f"/v1/contractors/{seed.id}")
    assert response.status_code == 403
