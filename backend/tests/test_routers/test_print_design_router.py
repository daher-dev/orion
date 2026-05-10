"""HTTP integration tests for /v1/prints."""

import uuid

import pytest
from httpx import AsyncClient

from tests.factories import (
    create_company,
    create_print_design,
    create_product,
    create_product_spec,
    create_user,
    get_role_by_code,
)


def _create_payload(**overrides) -> dict:
    base = {
        "code": f"EST-{uuid.uuid4().hex[:6].upper()}",
        "name": "Aurora — Sol nascente",
        "image_url": None,
        "cost_per_unit": "4.20",
    }
    base.update(overrides)
    return base


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


# ---------- GET /v1/prints ----------


async def test_list_prints_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/prints")
    assert response.status_code == 401


async def test_list_prints_returns_paginated_envelope(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    await create_print_design(db_session, company_id=company.id, code="A1", name="Aurora")

    response = await authed_client.get("/v1/prints")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["page"] == 1
    assert body["items"][0]["code"] == "A1"


async def test_list_prints_only_tenant_rows(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    other = await create_company(db_session)
    await create_print_design(db_session, company_id=company.id, name="Mine", code="EST-A")
    await create_print_design(db_session, company_id=other.id, name="Theirs", code="EST-B")

    response = await authed_client.get("/v1/prints")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Mine"


async def test_list_prints_filters_by_q(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    await create_print_design(db_session, company_id=company.id, code="EST-001", name="Aurora")
    await create_print_design(db_session, company_id=company.id, code="EST-002", name="Botânica")

    response = await authed_client.get("/v1/prints", params={"q": "aurora"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["code"] == "EST-001"


async def test_list_prints_paginates(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    for i in range(3):
        await create_print_design(db_session, company_id=company.id, code=f"EST-{i:02d}")

    response = await authed_client.get("/v1/prints", params={"page": 1, "page_size": 2})
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["has_more"] is True


async def test_list_prints_allows_operator_read(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    await create_print_design(db_session, company_id=company.id)
    response = await authed_client.get("/v1/prints")
    assert response.status_code == 200


# ---------- GET /v1/prints/{id} ----------


async def test_get_print_200(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    print_design = await create_print_design(db_session, company_id=company.id, code="GET-1")

    response = await authed_client.get(f"/v1/prints/{print_design.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["code"] == "GET-1"


async def test_get_print_404_when_missing(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.get(f"/v1/prints/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_get_print_404_when_other_tenant(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    other = await create_company(db_session)
    other_print = await create_print_design(db_session, company_id=other.id)

    response = await authed_client.get(f"/v1/prints/{other_print.id}")
    assert response.status_code == 404


# ---------- POST /v1/prints ----------


async def test_create_print_201(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.post("/v1/prints", json=_create_payload(code="C-NEW"))
    assert response.status_code == 201
    body = response.json()
    assert body["code"] == "C-NEW"


async def test_create_print_409_on_duplicate(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    await create_print_design(db_session, company_id=company.id, code="DUP")
    response = await authed_client.post("/v1/prints", json=_create_payload(code="DUP"))
    assert response.status_code == 409


async def test_create_print_422_when_name_missing(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.post(
        "/v1/prints",
        json={"code": "C-1", "cost_per_unit": "1.00"},
    )
    assert response.status_code == 422


async def test_create_print_422_when_cost_negative(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.post(
        "/v1/prints",
        json=_create_payload(cost_per_unit="-1.00"),
    )
    assert response.status_code == 422


async def test_create_print_403_for_operator(authed_client: AsyncClient, db_session):
    await _provision_operator(db_session)
    response = await authed_client.post("/v1/prints", json=_create_payload())
    assert response.status_code == 403


async def test_create_print_401_anonymous(async_client: AsyncClient):
    response = await async_client.post("/v1/prints", json=_create_payload())
    assert response.status_code == 401


# ---------- PATCH /v1/prints/{id} ----------


async def test_update_print_200(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    print_design = await create_print_design(db_session, company_id=company.id, code="EDIT-1")

    response = await authed_client.patch(
        f"/v1/prints/{print_design.id}",
        json={"name": "Renamed", "cost_per_unit": "5.50"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Renamed"
    assert body["cost_per_unit"] == "5.50"


async def test_update_print_409_on_code_conflict(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    await create_print_design(db_session, company_id=company.id, code="EXISTS")
    target = await create_print_design(db_session, company_id=company.id, code="OTHER")
    response = await authed_client.patch(
        f"/v1/prints/{target.id}",
        json={"code": "EXISTS"},
    )
    assert response.status_code == 409


async def test_update_print_404_when_missing(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.patch(f"/v1/prints/{uuid.uuid4()}", json={"name": "X"})
    assert response.status_code == 404


async def test_update_print_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    print_design = await create_print_design(db_session, company_id=company.id)
    response = await authed_client.patch(f"/v1/prints/{print_design.id}", json={"name": "X"})
    assert response.status_code == 403


async def test_update_print_401_anonymous(async_client: AsyncClient, db_session):
    company = await create_company(db_session)
    print_design = await create_print_design(db_session, company_id=company.id)
    response = await async_client.patch(f"/v1/prints/{print_design.id}", json={"name": "X"})
    assert response.status_code == 401


# ---------- DELETE /v1/prints/{id} ----------


async def test_delete_print_204(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    print_design = await create_print_design(db_session, company_id=company.id)
    response = await authed_client.delete(f"/v1/prints/{print_design.id}")
    assert response.status_code == 204


async def test_delete_print_409_when_referenced(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    print_design = await create_print_design(db_session, company_id=company.id)
    await create_product(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        print_id=print_design.id,
    )
    response = await authed_client.delete(f"/v1/prints/{print_design.id}")
    assert response.status_code == 409


async def test_delete_print_404(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.delete(f"/v1/prints/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_delete_print_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    print_design = await create_print_design(db_session, company_id=company.id)
    response = await authed_client.delete(f"/v1/prints/{print_design.id}")
    assert response.status_code == 403


async def test_delete_print_401_anonymous(async_client: AsyncClient, db_session):
    company = await create_company(db_session)
    print_design = await create_print_design(db_session, company_id=company.id)
    response = await async_client.delete(f"/v1/prints/{print_design.id}")
    assert response.status_code == 401


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/v1/prints"),
        ("post", "/v1/prints"),
    ],
)
async def test_protected_endpoints_reject_anonymous(async_client: AsyncClient, method: str, path: str):
    func = getattr(async_client, method)
    response = await func(path) if method == "get" else await func(path, json=_create_payload())
    assert response.status_code == 401
