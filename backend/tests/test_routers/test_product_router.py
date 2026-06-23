"""HTTP integration tests for /v1/products."""

import uuid

import pytest
from httpx import AsyncClient

from tests.factories import (
    create_ad,
    create_company,
    create_print_design,
    create_product,
    create_product_spec,
    create_user,
    get_role_by_code,
)


def _variation_payload(size: str = "m", color: str = "Preto", color_code: str = "PRT") -> dict:
    return {"size": size, "color": color, "color_code": color_code}


def _create_payload(
    *,
    spec_id: str,
    print_id: str | None = None,
    **overrides,
) -> dict:
    body: dict = {
        "name": "Cropped Oversized",
        "product_type": "camiseta",
        "spec_id": spec_id,
        "print_id": print_id,
        "variations": [_variation_payload()],
    }
    body.update(overrides)
    return body


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


# ---------- GET /v1/products ----------


async def test_list_products_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/products")
    assert response.status_code == 401


async def test_list_products_paginated_envelope(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    await create_product(db_session, company_id=company.id, spec_id=spec.id, name="X1")

    response = await authed_client.get("/v1/products")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "X1"


async def test_list_products_only_tenant_rows(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    other = await create_company(db_session)
    spec_a = await create_product_spec(db_session, company_id=company.id)
    spec_b = await create_product_spec(db_session, company_id=other.id)
    await create_product(db_session, company_id=company.id, spec_id=spec_a.id, name="Mine")
    await create_product(db_session, company_id=other.id, spec_id=spec_b.id, name="Theirs")

    response = await authed_client.get("/v1/products")
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Mine"


async def test_list_products_filters_by_q(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec_a = await create_product_spec(db_session, company_id=company.id, code="FT-A")
    spec_b = await create_product_spec(db_session, company_id=company.id, code="FT-B")
    await create_product(db_session, company_id=company.id, spec_id=spec_a.id, name="Cropped")
    await create_product(db_session, company_id=company.id, spec_id=spec_b.id, name="Longline")

    response = await authed_client.get("/v1/products", params={"q": "crop"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Cropped"


async def test_list_products_filters_by_type(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec_a = await create_product_spec(db_session, company_id=company.id, code="FT-A")
    spec_b = await create_product_spec(db_session, company_id=company.id, code="FT-B")
    await create_product(db_session, company_id=company.id, spec_id=spec_a.id, product_type="camiseta", name="T")
    await create_product(
        db_session,
        company_id=company.id,
        spec_id=spec_b.id,
        product_type="moletom",
        name="S",
    )
    response = await authed_client.get("/v1/products", params={"product_type": "moletom"})
    body = response.json()
    assert body["total"] == 1


async def test_list_products_allows_operator_read(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    await create_product(db_session, company_id=company.id, spec_id=spec.id)
    response = await authed_client.get("/v1/products")
    assert response.status_code == 200


# ---------- GET /v1/products/{id} ----------


async def test_get_product_200(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id, name="G1")
    response = await authed_client.get(f"/v1/products/{product.id}")
    body = response.json()
    assert response.status_code == 200
    assert body["name"] == "G1"
    assert body["variations"] == []


async def test_get_product_404(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.get(f"/v1/products/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_get_product_404_when_other_tenant(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    other = await create_company(db_session)
    spec = await create_product_spec(db_session, company_id=other.id)
    other_product = await create_product(db_session, company_id=other.id, spec_id=spec.id)
    response = await authed_client.get(f"/v1/products/{other_product.id}")
    assert response.status_code == 404


# ---------- POST /v1/products ----------


async def test_create_product_201(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAMNW")
    response = await authed_client.post(
        "/v1/products",
        json=_create_payload(spec_id=str(spec.id)),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Cropped Oversized"
    assert len(body["variations"]) == 1
    assert body["variations"][0]["sku"] == "CAMNW-M-PRT"


async def test_create_product_with_print_derives_full_sku(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="MOL01")
    print_design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    response = await authed_client.post(
        "/v1/products",
        json=_create_payload(
            spec_id=str(spec.id),
            print_id=str(print_design.id),
            variations=[_variation_payload("p", "Off-white", "OFF")],
        ),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["variations"][0]["sku"] == "MOL01-P-OFF-FLR03"


async def test_create_product_409_on_duplicate_spec_print(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    print_design = await create_print_design(db_session, company_id=company.id)
    await create_product(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        print_id=print_design.id,
    )
    response = await authed_client.post(
        "/v1/products",
        json=_create_payload(spec_id=str(spec.id), print_id=str(print_design.id)),
    )
    assert response.status_code == 409


async def test_create_product_422_when_no_variations(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/products",
        json=_create_payload(spec_id=str(spec.id), variations=[]),
    )
    assert response.status_code == 422


async def test_create_product_422_on_bad_color_code(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/products",
        json=_create_payload(
            spec_id=str(spec.id),
            variations=[_variation_payload(color_code="bla")],  # lowercase
        ),
    )
    assert response.status_code == 422


async def test_create_product_422_when_color_not_in_palette(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/products",
        json=_create_payload(
            spec_id=str(spec.id),
            variations=[_variation_payload(color="Roxo Neon", color_code="ZZZ")],  # off-palette
        ),
    )
    assert response.status_code == 422
    assert "palette" in response.text.lower()


async def test_create_product_422_when_spec_id_missing(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.post(
        "/v1/products",
        json={
            "name": "x",
            "product_type": "camiseta",
            "variations": [_variation_payload()],
        },
    )
    assert response.status_code == 422


async def test_create_product_422_when_spec_unknown(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.post(
        "/v1/products",
        json=_create_payload(spec_id=str(uuid.uuid4())),
    )
    assert response.status_code == 422


async def test_create_product_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/products",
        json=_create_payload(spec_id=str(spec.id)),
    )
    assert response.status_code == 403


async def test_create_product_401_anonymous(async_client: AsyncClient):
    response = await async_client.post(
        "/v1/products",
        json=_create_payload(spec_id=str(uuid.uuid4())),
    )
    assert response.status_code == 401


# ---------- PATCH /v1/products/{id} ----------


async def test_update_product_200_renames(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id, name="Old")

    response = await authed_client.patch(
        f"/v1/products/{product.id}",
        json={"name": "Renamed"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"


async def test_update_product_replaces_variations(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAMUP")
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)

    response = await authed_client.patch(
        f"/v1/products/{product.id}",
        json={
            "variations": [
                _variation_payload("p", "Preto", "PRT"),
                _variation_payload("gg", "Off-white", "OFF"),
            ],
        },
    )
    body = response.json()
    assert response.status_code == 200
    assert len(body["variations"]) == 2
    skus = {v["sku"] for v in body["variations"]}
    assert skus == {"CAMUP-P-PRT", "CAMUP-GG-OFF"}


async def test_update_product_409_on_spec_print_conflict(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    print_a = await create_print_design(db_session, company_id=company.id, code="EST-A")
    print_b = await create_print_design(db_session, company_id=company.id, code="EST-B")
    await create_product(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        print_id=print_a.id,
    )
    target = await create_product(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        print_id=print_b.id,
    )
    response = await authed_client.patch(
        f"/v1/products/{target.id}",
        json={"print_id": str(print_a.id)},
    )
    assert response.status_code == 409


async def test_update_product_404(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.patch(
        f"/v1/products/{uuid.uuid4()}",
        json={"name": "x"},
    )
    assert response.status_code == 404


async def test_update_product_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    response = await authed_client.patch(
        f"/v1/products/{product.id}",
        json={"name": "x"},
    )
    assert response.status_code == 403


async def test_update_product_401_anonymous(async_client: AsyncClient, db_session):
    company = await create_company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    response = await async_client.patch(
        f"/v1/products/{product.id}",
        json={"name": "x"},
    )
    assert response.status_code == 401


# ---------- DELETE /v1/products/{id} ----------


async def test_delete_product_204(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    response = await authed_client.delete(f"/v1/products/{product.id}")
    assert response.status_code == 204


async def test_delete_product_409_when_ad_links_to_it(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    await create_ad(db_session, company_id=company.id, product_id=product.id)

    response = await authed_client.delete(f"/v1/products/{product.id}")
    assert response.status_code == 409


async def test_delete_product_404(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.delete(f"/v1/products/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_delete_product_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    response = await authed_client.delete(f"/v1/products/{product.id}")
    assert response.status_code == 403


async def test_delete_product_401_anonymous(async_client: AsyncClient, db_session):
    company = await create_company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    response = await async_client.delete(f"/v1/products/{product.id}")
    assert response.status_code == 401


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/v1/products"),
        ("post", "/v1/products"),
    ],
)
async def test_protected_endpoints_reject_anonymous(
    async_client: AsyncClient,
    method: str,
    path: str,
):
    func = getattr(async_client, method)
    if method == "get":
        response = await func(path)
    else:
        response = await func(
            path,
            json=_create_payload(spec_id=str(uuid.uuid4())),
        )
    assert response.status_code == 401
