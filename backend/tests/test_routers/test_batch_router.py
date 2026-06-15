import uuid

from httpx import AsyncClient

from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_print_design,
    create_product,
    create_product_spec,
    create_product_variation,
    create_user,
    get_role_by_code,
)
from tests.factories import (
    create_order as factory_create_order,
)


async def _provision_manager(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid=firebase_uid)
    return company, user


async def _provision_operator(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(db_session, company_id=company.id, role_id=operator_role.id, firebase_uid=firebase_uid)
    return company, user


async def _seed_order(db_session, *, company_id: uuid.UUID, **order_overrides):
    design = await create_print_design(db_session, company_id=company_id)
    spec = await create_product_spec(db_session, company_id=company_id)
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id, print_id=design.id)
    variation = await create_product_variation(db_session, company_id=company_id, product_id=product.id)
    ad = await create_ad(db_session, company_id=company_id, product_id=product.id)
    client = await create_client(db_session, company_id=company_id)
    order = await factory_create_order(
        db_session,
        company_id=company_id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        **order_overrides,
    )
    return order, design


async def test_list_batches_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/batches")
    assert response.status_code == 401


async def test_batch_full_lifecycle(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    order, _design = await _seed_order(db_session, company_id=company.id, quantity=4, external_order_id="A1")

    # Create.
    resp = await authed_client.post("/v1/batches", json={"order_ids": [str(order.id)]})
    assert resp.status_code == 201, resp.text
    batch = resp.json()
    assert batch["status"] == "open"
    assert batch["total_pieces"] == 4
    assert "adjustments" not in batch
    batch_id = batch["id"]

    # List.
    resp = await authed_client.get("/v1/batches")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    # Get.
    resp = await authed_client.get(f"/v1/batches/{batch_id}")
    assert resp.status_code == 200

    # Transition OPEN -> IN_PRODUCTION.
    resp = await authed_client.post(f"/v1/batches/{batch_id}/status", json={"status": "in_production"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_production"

    # Transition IN_PRODUCTION -> DISPATCHED.
    resp = await authed_client.post(f"/v1/batches/{batch_id}/status", json={"status": "dispatched"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "dispatched"

    # Delete.
    resp = await authed_client.delete(f"/v1/batches/{batch_id}")
    assert resp.status_code == 204

    resp = await authed_client.get(f"/v1/batches/{batch_id}")
    assert resp.status_code == 404


async def test_invalid_transition_returns_409(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    order, _ = await _seed_order(db_session, company_id=company.id, external_order_id="A1")
    resp = await authed_client.post("/v1/batches", json={"order_ids": [str(order.id)]})
    batch_id = resp.json()["id"]

    # OPEN -> DONE is illegal.
    resp = await authed_client.post(f"/v1/batches/{batch_id}/status", json={"status": "done"})
    assert resp.status_code == 409


async def test_create_batch_forbidden_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    order, _ = await _seed_order(db_session, company_id=company.id, external_order_id="A1")
    resp = await authed_client.post("/v1/batches", json={"order_ids": [str(order.id)]})
    assert resp.status_code == 403
