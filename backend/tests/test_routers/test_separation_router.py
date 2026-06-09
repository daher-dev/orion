"""Router tests for the order separation / labeling / check-out endpoints.

Covers:
- POST /v1/orders/{order_id}/labels
- POST /v1/orders/separation/scan
"""

import uuid

from httpx import AsyncClient

from tests.factories import (
    create_ad,
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


async def _seed_order(db_session, *, company_id: uuid.UUID, quantity: int = 2):
    spec = await create_product_spec(db_session, company_id=company_id)
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id)
    variation = await create_product_variation(db_session, company_id=company_id, product_id=product.id)
    ad = await create_ad(db_session, company_id=company_id, product_id=product.id)
    client = await create_client(db_session, company_id=company_id)
    order = await create_order(
        db_session,
        company_id=company_id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        quantity=quantity,
    )
    return order


# ----------------------------------------------- POST /v1/orders/{id}/labels


async def test_generate_labels_requires_auth(async_client: AsyncClient):
    response = await async_client.post(f"/v1/orders/{uuid.uuid4()}/labels")
    assert response.status_code == 401


async def test_generate_labels_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    order = await _seed_order(db_session, company_id=company.id, quantity=1)
    response = await authed_client.post(f"/v1/orders/{order.id}/labels")
    assert response.status_code == 403


async def test_generate_labels_happy_path(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    order = await _seed_order(db_session, company_id=company.id, quantity=3)

    response = await authed_client.post(f"/v1/orders/{order.id}/labels")

    assert response.status_code == 200
    body = response.json()
    assert body["order_id"] == str(order.id)
    assert body["total_items"] == 3
    assert len(body["labels"]) == 3
    first = body["labels"][0]
    assert first["tracking_code"]
    assert first["qr_data"] == first["tracking_code"]
    assert first["status"] == "label_printed"
    assert first["order_code"].startswith("ORD-")


async def test_generate_labels_unknown_order_404(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.post(f"/v1/orders/{uuid.uuid4()}/labels")
    assert response.status_code == 404


# ----------------------------------------------- POST /v1/orders/separation/scan


async def test_scan_requires_auth(async_client: AsyncClient):
    response = await async_client.post("/v1/orders/separation/scan", json={"tracking_code": "X"})
    assert response.status_code == 401


async def test_scan_403_for_operator(authed_client: AsyncClient, db_session):
    await _provision_operator(db_session)
    response = await authed_client.post("/v1/orders/separation/scan", json={"tracking_code": "X"})
    assert response.status_code == 403


async def test_scan_happy_path(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    order = await _seed_order(db_session, company_id=company.id, quantity=1)

    labels = (await authed_client.post(f"/v1/orders/{order.id}/labels")).json()
    code = labels["labels"][0]["tracking_code"]

    response = await authed_client.post("/v1/orders/separation/scan", json={"tracking_code": code})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "checked"
    assert body["tracking_code"] == code
    # checked_by is the resolved DB user's email (set by the user factory).
    assert body["checked_by"]
    assert body["checked_at"] is not None
    assert body["already_checked"] is False


async def test_scan_unknown_code_404(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.post("/v1/orders/separation/scan", json={"tracking_code": "NOPE-NOT-A-CODE"})
    assert response.status_code == 404


async def test_scan_is_idempotent(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    order = await _seed_order(db_session, company_id=company.id, quantity=1)
    labels = (await authed_client.post(f"/v1/orders/{order.id}/labels")).json()
    code = labels["labels"][0]["tracking_code"]

    await authed_client.post("/v1/orders/separation/scan", json={"tracking_code": code})
    second = await authed_client.post("/v1/orders/separation/scan", json={"tracking_code": code})

    assert second.status_code == 200
    assert second.json()["already_checked"] is True
