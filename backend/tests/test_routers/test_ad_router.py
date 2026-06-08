import uuid

from httpx import AsyncClient

from models import Ecommerce
from tests.factories import (
    create_ad as factory_create_ad,
)
from tests.factories import (
    create_client,
    create_company,
    create_order,
    create_product,
    create_product_spec,
    create_product_variation,
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


async def _seed_product(db_session, *, company_id: uuid.UUID, **overrides):
    spec = await create_product_spec(db_session, company_id=company_id)
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id, **overrides)
    return product, spec


# ---------- GET /v1/ads ----------


async def test_list_ads_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/ads")
    assert response.status_code == 401


async def test_list_ads_returns_only_tenant_rows(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    other = await create_company(db_session)
    product_a, _ = await _seed_product(db_session, company_id=company.id, name="Mine")
    product_b, _ = await _seed_product(db_session, company_id=other.id, name="Theirs")
    await factory_create_ad(db_session, company_id=company.id, product_id=product_a.id, title="Ad A")
    await factory_create_ad(db_session, company_id=other.id, product_id=product_b.id, title="Ad B")

    response = await authed_client.get("/v1/ads")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "Ad A"
    assert body["items"][0]["products"][0]["name"] == "Mine"
    assert body["items"][0]["products"][0]["code"]  # spec code surfaces


async def test_list_ads_filters_by_query(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)
    await factory_create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        title="Cropped Verão",
    )
    await factory_create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        title="Box Premium",
    )

    response = await authed_client.get("/v1/ads", params={"q": "verão"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "Cropped Verão"


async def test_list_ads_filters_by_channel(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)
    await factory_create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        ecommerce=Ecommerce.SHOPEE,
        title="S",
    )
    await factory_create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        ecommerce=Ecommerce.MERCADO_LIVRE,
        title="M",
    )

    response = await authed_client.get("/v1/ads", params={"ecommerce": "mercado_livre"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["ecommerce"] == "mercado_livre"


async def test_list_ads_filters_by_product(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    product1, _ = await _seed_product(db_session, company_id=company.id, name="P1")
    product2, _ = await _seed_product(db_session, company_id=company.id, name="P2")
    await factory_create_ad(db_session, company_id=company.id, product_id=product1.id, title="A1")
    await factory_create_ad(db_session, company_id=company.id, product_id=product2.id, title="A2")

    response = await authed_client.get("/v1/ads", params={"product_id": str(product2.id)})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "A2"


async def test_list_ads_paginates(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)
    for i in range(3):
        await factory_create_ad(
            db_session,
            company_id=company.id,
            product_id=product.id,
            title=f"Ad{i}",
        )

    response = await authed_client.get("/v1/ads", params={"page": 1, "page_size": 2})
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["has_more"] is True


async def test_list_ads_rejects_unknown_user(authed_client: AsyncClient, db_session):
    await create_company(db_session)
    response = await authed_client.get("/v1/ads")
    assert response.status_code == 401


# ---------- GET /v1/ads/{id} ----------


async def test_get_ad_detail(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    product, spec = await _seed_product(db_session, company_id=company.id, name="Detail")
    ad = await factory_create_ad(db_session, company_id=company.id, product_id=product.id, title="A")

    response = await authed_client.get(f"/v1/ads/{ad.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "A"
    assert body["products"][0]["id"] == str(product.id)
    assert body["products"][0]["code"] == spec.code


async def test_get_ad_404_when_unknown(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.get(f"/v1/ads/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_get_ad_404_when_other_tenant(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    other = await create_company(db_session)
    other_product, _ = await _seed_product(db_session, company_id=other.id)
    other_ad = await factory_create_ad(db_session, company_id=other.id, product_id=other_product.id)

    response = await authed_client.get(f"/v1/ads/{other_ad.id}")
    assert response.status_code == 404


# ---------- POST /v1/ads ----------


async def test_create_ad_201(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)

    response = await authed_client.post(
        "/v1/ads",
        json={
            "title": "New Ad",
            "ecommerce": "shopee",
            "external_id": "SH-1",
            "product_ids": [str(product.id)],
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "New Ad"
    assert body["ecommerce"] == "shopee"
    assert body["external_id"] == "SH-1"


async def test_create_ad_422_when_title_missing(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)

    response = await authed_client.post(
        "/v1/ads",
        json={"ecommerce": "shopee", "product_ids": [str(product.id)]},
    )
    assert response.status_code == 422


async def test_create_ad_422_when_channel_invalid(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)

    response = await authed_client.post(
        "/v1/ads",
        json={
            "title": "X",
            "ecommerce": "not-a-channel",
            "product_ids": [str(product.id)],
        },
    )
    assert response.status_code == 422


async def test_create_ad_422_when_product_missing(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)

    response = await authed_client.post(
        "/v1/ads",
        json={
            "title": "X",
            "ecommerce": "shopee",
            "product_ids": [str(uuid.uuid4())],
        },
    )
    assert response.status_code == 422  # ValidationError → 422


async def test_create_ad_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)

    response = await authed_client.post(
        "/v1/ads",
        json={
            "title": "X",
            "ecommerce": "shopee",
            "product_ids": [str(product.id)],
        },
    )
    assert response.status_code == 403


async def test_create_ad_401_anonymous(async_client: AsyncClient):
    response = await async_client.post(
        "/v1/ads",
        json={
            "title": "X",
            "ecommerce": "shopee",
            "product_ids": [str(uuid.uuid4())],
        },
    )
    assert response.status_code == 401


# ---------- PATCH /v1/ads/{id} ----------


async def test_update_ad_200(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)
    ad = await factory_create_ad(db_session, company_id=company.id, product_id=product.id, title="Old")

    response = await authed_client.patch(
        f"/v1/ads/{ad.id}",
        json={"title": "New"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "New"


async def test_update_ad_404_when_unknown(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.patch(f"/v1/ads/{uuid.uuid4()}", json={"title": "X"})
    assert response.status_code == 404


async def test_update_ad_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)
    ad = await factory_create_ad(db_session, company_id=company.id, product_id=product.id)

    response = await authed_client.patch(f"/v1/ads/{ad.id}", json={"title": "X"})
    assert response.status_code == 403


async def test_update_ad_401_anonymous(async_client: AsyncClient, db_session):
    company = await create_company(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)
    ad = await factory_create_ad(db_session, company_id=company.id, product_id=product.id)

    response = await async_client.patch(f"/v1/ads/{ad.id}", json={"title": "X"})
    assert response.status_code == 401


# ---------- DELETE /v1/ads/{id} ----------


async def test_delete_ad_204(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)
    ad = await factory_create_ad(db_session, company_id=company.id, product_id=product.id)

    response = await authed_client.delete(f"/v1/ads/{ad.id}")
    assert response.status_code == 204


async def test_delete_ad_409_when_orders_linked(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)
    variation = await create_product_variation(db_session, company_id=company.id, product_id=product.id)
    client = await create_client(db_session, company_id=company.id)
    ad = await factory_create_ad(db_session, company_id=company.id, product_id=product.id)
    await create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )

    response = await authed_client.delete(f"/v1/ads/{ad.id}")
    assert response.status_code == 409
    assert "orders" in response.json()["detail"].lower()


async def test_delete_ad_404_when_unknown(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.delete(f"/v1/ads/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_delete_ad_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)
    ad = await factory_create_ad(db_session, company_id=company.id, product_id=product.id)

    response = await authed_client.delete(f"/v1/ads/{ad.id}")
    assert response.status_code == 403


async def test_delete_ad_401_anonymous(async_client: AsyncClient, db_session):
    company = await create_company(db_session)
    product, _ = await _seed_product(db_session, company_id=company.id)
    ad = await factory_create_ad(db_session, company_id=company.id, product_id=product.id)

    response = await async_client.delete(f"/v1/ads/{ad.id}")
    assert response.status_code == 401
