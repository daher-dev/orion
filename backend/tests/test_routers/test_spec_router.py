"""HTTP integration tests for /v1/specs."""

import uuid

import pytest
from httpx import AsyncClient

from models.enums import FabricType, TrimType
from tests.factories import (
    create_company,
    create_product,
    create_product_spec,
    create_spec_trim,
    create_user,
    get_role_by_code,
)


def _create_payload(**overrides) -> dict:
    base = {
        "code": f"FT-{uuid.uuid4().hex[:6].upper()}",
        "name": "Cropped Jersey",
        "fabric_type": FabricType.JERSEY.value,
        "fabric_grammage_gsm": 180,
        "fabric_weight_per_piece_g": "250.00",
        "has_ribana": False,
        "ribana_weight_pct": None,
        "labor_cost": "12.00",
        "sale_price": "99.00",
        "trims": [],
    }
    base.update(overrides)
    return base


# ------------------------------------------------------------------ list


async def test_list_specs_returns_paginated_envelope(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    spec = await create_product_spec(db_session, company_id=company.id, code="A1")
    await create_spec_trim(db_session, spec_id=spec.id, trim_type=TrimType.LABEL)

    response = await authed_client.get("/v1/specs")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["page"] == 1
    assert body["items"][0]["code"] == "A1"
    assert len(body["items"][0]["trims"]) == 1


async def test_list_specs_filter_q_and_fabric_type(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    await create_product_spec(
        db_session, company_id=company.id, code="J-1", name="Jersey one", fabric_type=FabricType.JERSEY
    )
    await create_product_spec(
        db_session, company_id=company.id, code="F-1", name="Fleece one", fabric_type=FabricType.FLEECE
    )

    response = await authed_client.get(
        "/v1/specs",
        params={"q": "fleece", "fabric_type": FabricType.FLEECE.value},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["code"] == "F-1"


async def test_list_specs_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/specs")
    assert response.status_code == 401


async def test_list_specs_allows_operator_read(authed_client: AsyncClient, db_session):
    """Operators have `specs.read` and can list — the read gate is permissive for them."""
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    await create_user(
        db_session,
        company_id=company.id,
        firebase_uid="qa-dev-user",
        role_id=operator_role.id,
    )
    response = await authed_client.get("/v1/specs")
    assert response.status_code == 200


# ------------------------------------------------------------------ get


async def test_get_spec_200(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    spec = await create_product_spec(db_session, company_id=company.id, code="G-1")

    response = await authed_client.get(f"/v1/specs/{spec.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["code"] == "G-1"
    assert body["trims"] == []


async def test_get_spec_404_other_tenant(authed_client: AsyncClient, db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    await create_user(db_session, company_id=company_b.id, firebase_uid="qa-dev-user")
    spec = await create_product_spec(db_session, company_id=company_a.id)
    response = await authed_client.get(f"/v1/specs/{spec.id}")
    assert response.status_code == 404


async def test_get_spec_404_when_missing(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    response = await authed_client.get(f"/v1/specs/{uuid.uuid4()}")
    assert response.status_code == 404


# ------------------------------------------------------------------ create


async def test_create_spec_201(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    payload = _create_payload(
        code="C-NEW",
        trims=[
            {"trim_type": TrimType.LABEL.value, "unit_price": "0.50", "quantity": 2},
            {"trim_type": TrimType.BUTTON.value, "unit_price": "0.85", "quantity": 6},
        ],
    )
    response = await authed_client.post("/v1/specs", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["code"] == "C-NEW"
    assert len(body["trims"]) == 2


async def test_create_spec_409_on_duplicate(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    await create_product_spec(db_session, company_id=company.id, code="DUP")
    response = await authed_client.post("/v1/specs", json=_create_payload(code="DUP"))
    assert response.status_code == 409


async def test_create_spec_422_when_ribana_pct_missing(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    response = await authed_client.post(
        "/v1/specs",
        json=_create_payload(has_ribana=True, ribana_weight_pct=None),
    )
    assert response.status_code == 422


async def test_create_spec_403_when_no_write(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    await create_user(
        db_session,
        company_id=company.id,
        firebase_uid="qa-dev-user",
        role_id=operator_role.id,
    )
    response = await authed_client.post("/v1/specs", json=_create_payload())
    assert response.status_code == 403


async def test_create_spec_401(async_client: AsyncClient):
    response = await async_client.post("/v1/specs", json=_create_payload())
    assert response.status_code == 401


# ------------------------------------------------------------------ update


async def test_update_spec_200_and_replaces_trims(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    spec = await create_product_spec(db_session, company_id=company.id, code="EDIT-1")
    await create_spec_trim(db_session, spec_id=spec.id, trim_type=TrimType.LABEL)

    response = await authed_client.patch(
        f"/v1/specs/{spec.id}",
        json={
            "name": "Renamed",
            "trims": [
                {"trim_type": TrimType.ZIPPER.value, "unit_price": "3.00", "quantity": 1},
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Renamed"
    assert len(body["trims"]) == 1
    assert body["trims"][0]["trim_type"] == TrimType.ZIPPER.value


async def test_update_spec_404(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    response = await authed_client.patch(
        f"/v1/specs/{uuid.uuid4()}",
        json={"name": "X"},
    )
    assert response.status_code == 404


async def test_update_spec_409_on_code_conflict(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    await create_product_spec(db_session, company_id=company.id, code="EXISTS")
    target = await create_product_spec(db_session, company_id=company.id, code="OTHER")
    response = await authed_client.patch(
        f"/v1/specs/{target.id}",
        json={"code": "EXISTS"},
    )
    assert response.status_code == 409


async def test_update_spec_403_no_write(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    await create_user(
        db_session,
        company_id=company.id,
        firebase_uid="qa-dev-user",
        role_id=operator_role.id,
    )
    spec = await create_product_spec(db_session, company_id=company.id)
    response = await authed_client.patch(f"/v1/specs/{spec.id}", json={"name": "X"})
    assert response.status_code == 403


# ------------------------------------------------------------------ delete


async def test_delete_spec_204(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    spec = await create_product_spec(db_session, company_id=company.id)
    response = await authed_client.delete(f"/v1/specs/{spec.id}")
    assert response.status_code == 204


async def test_delete_spec_409_when_referenced(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    spec = await create_product_spec(db_session, company_id=company.id)
    await create_product(db_session, company_id=company.id, spec_id=spec.id)
    response = await authed_client.delete(f"/v1/specs/{spec.id}")
    assert response.status_code == 409


async def test_delete_spec_404(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    response = await authed_client.delete(f"/v1/specs/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/v1/specs"),
        ("post", "/v1/specs"),
    ],
)
async def test_protected_endpoints_reject_anonymous(async_client: AsyncClient, method: str, path: str):
    func = getattr(async_client, method)
    response = await func(path) if method == "get" else await func(path, json=_create_payload())
    assert response.status_code == 401
