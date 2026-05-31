import uuid
from datetime import UTC, datetime

from httpx import AsyncClient
from sqlmodel import select

from models import CuttingOrder, CuttingStatus, Size
from tests.factories import (
    create_company,
    create_cutting_order,
    create_cutting_order_output,
    create_fabric_roll,
    create_product,
    create_product_spec,
    create_sewing_contractor,
    create_sewing_shipment,
    create_user,
    get_role_by_code,
)

# ----------------------------------------------------------------- helpers


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


async def _seed_world(db_session, company_id):
    spec = await create_product_spec(db_session, company_id=company_id, code="CRP01")
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id, name="Cropped")
    body = await create_fabric_roll(db_session, company_id=company_id)
    return product, body


def _create_payload(*, product_id: uuid.UUID, body_roll_id: uuid.UUID, **overrides) -> dict:
    base: dict = {
        "product_id": str(product_id),
        "body_roll_id": str(body_roll_id),
        "planned_outputs": [{"size": "m", "quantity": 12}],
    }
    base.update(overrides)
    return base


# ------------------------------------------------------------------- auth


async def test_list_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/cutting")
    assert response.status_code == 401


async def test_create_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.post(
        "/v1/cutting",
        json=_create_payload(product_id=uuid.uuid4(), body_roll_id=uuid.uuid4()),
    )
    assert response.status_code == 401


# ------------------------------------------------------------------- GET /


async def test_list_returns_empty_page_for_new_tenant(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get("/v1/cutting")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_list_returns_tenant_rows(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    product, body = await _seed_world(db_session, company.id)
    await create_cutting_order(db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id)
    response = await authed_client.get("/v1/cutting")
    assert response.status_code == 200
    body_json = response.json()
    assert body_json["total"] == 1
    assert body_json["items"][0]["product"]["id"] == str(product.id)
    assert body_json["items"][0]["product"]["code"] == "CRP01"


async def test_list_supports_status_filter(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    product, body = await _seed_world(db_session, company.id)
    await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=body.id,
        status=CuttingStatus.PENDING,
    )
    await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=body.id,
        status=CuttingStatus.DONE,
        cut_at=datetime.now(UTC),
    )

    response = await authed_client.get("/v1/cutting", params={"status": "done"})
    assert response.status_code == 200
    body_json = response.json()
    assert body_json["total"] == 1
    assert body_json["items"][0]["status"] == "done"


async def test_list_supports_product_filter(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    product, body = await _seed_world(db_session, company.id)
    spec2 = await create_product_spec(db_session, company_id=company.id, code="OTH01")
    product2 = await create_product(db_session, company_id=company.id, spec_id=spec2.id, name="Other")
    await create_cutting_order(db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id)
    await create_cutting_order(db_session, company_id=company.id, product_id=product2.id, body_roll_id=body.id)

    response = await authed_client.get("/v1/cutting", params={"product_id": str(product2.id)})
    body_json = response.json()
    assert body_json["total"] == 1
    assert body_json["items"][0]["product"]["id"] == str(product2.id)


async def test_list_pagination(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    product, body = await _seed_world(db_session, company.id)
    for _ in range(3):
        await create_cutting_order(db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id)
    response = await authed_client.get("/v1/cutting", params={"page_size": 2})
    body_json = response.json()
    assert body_json["total"] == 3
    assert len(body_json["items"]) == 2
    assert body_json["has_more"] is True


async def test_list_does_not_leak_other_tenants(authed_client: AsyncClient, db_session):
    company_a, _ = await _seed_admin(db_session)
    product_a, body_a = await _seed_world(db_session, company_a.id)
    await create_cutting_order(db_session, company_id=company_a.id, product_id=product_a.id, body_roll_id=body_a.id)

    company_b = await create_company(db_session)
    spec_b = await create_product_spec(db_session, company_id=company_b.id, code="OTH02")
    product_b = await create_product(db_session, company_id=company_b.id, spec_id=spec_b.id)
    body_b = await create_fabric_roll(db_session, company_id=company_b.id)
    await create_cutting_order(db_session, company_id=company_b.id, product_id=product_b.id, body_roll_id=body_b.id)

    response = await authed_client.get("/v1/cutting")
    body_json = response.json()
    assert body_json["total"] == 1
    assert body_json["items"][0]["product"]["id"] == str(product_a.id)


async def test_list_forbidden_when_no_permission(authed_client: AsyncClient, db_session):
    """A user attached to a role without `cutting.*` permission receives 403."""

    company = await create_company(db_session)
    from models import Role

    role = Role(code=f"custom-no-cutting-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)

    await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )
    response = await authed_client.get("/v1/cutting")
    assert response.status_code == 403


# ----------------------------------------------------------------- GET /{id}


async def test_get_returns_row(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    product, body = await _seed_world(db_session, company.id)
    order = await create_cutting_order(db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id)
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=10)

    response = await authed_client.get(f"/v1/cutting/{order.id}")
    assert response.status_code == 200
    body_json = response.json()
    assert body_json["id"] == str(order.id)
    assert body_json["body_roll"]["id"] == str(body.id)
    assert any(o["quantity"] == 10 for o in body_json["planned_outputs"])


async def test_get_404_when_unknown(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get(f"/v1/cutting/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_get_404_for_other_tenant_row(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    other = await create_company(db_session)
    spec_o = await create_product_spec(db_session, company_id=other.id, code="OTH03")
    product_o = await create_product(db_session, company_id=other.id, spec_id=spec_o.id)
    body_o = await create_fabric_roll(db_session, company_id=other.id)
    order = await create_cutting_order(db_session, company_id=other.id, product_id=product_o.id, body_roll_id=body_o.id)
    response = await authed_client.get(f"/v1/cutting/{order.id}")
    assert response.status_code == 404


# ------------------------------------------------------------------ POST /


async def test_create_success(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    product, body = await _seed_world(db_session, company.id)
    response = await authed_client.post(
        "/v1/cutting",
        json=_create_payload(product_id=product.id, body_roll_id=body.id),
    )
    assert response.status_code == 201
    body_json = response.json()
    assert body_json["status"] == "pending"
    assert body_json["body_roll"]["id"] == str(body.id)
    assert body_json["product"]["id"] == str(product.id)

    rows = (await db_session.exec(select(CuttingOrder).where(CuttingOrder.company_id == company.id))).all()
    assert len(list(rows)) == 1


async def test_create_with_rib_roll(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    product, body = await _seed_world(db_session, company.id)
    rib = await create_fabric_roll(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/cutting",
        json=_create_payload(
            product_id=product.id,
            body_roll_id=body.id,
            rib_roll_id=str(rib.id),
        ),
    )
    assert response.status_code == 201
    body_json = response.json()
    assert body_json["rib_roll"]["id"] == str(rib.id)


async def test_create_422_when_body_equals_rib(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    product, body = await _seed_world(db_session, company.id)
    response = await authed_client.post(
        "/v1/cutting",
        json=_create_payload(
            product_id=product.id,
            body_roll_id=body.id,
            rib_roll_id=str(body.id),
        ),
    )
    # Schema-level validator rejects identical rolls before the service
    # layer is reached → 422.
    assert response.status_code == 422


async def test_create_422_for_missing_required(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post("/v1/cutting", json={"planned_outputs": []})
    assert response.status_code == 422


async def test_create_422_for_unknown_product(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _product, body = await _seed_world(db_session, company.id)
    response = await authed_client.post(
        "/v1/cutting",
        json=_create_payload(product_id=uuid.uuid4(), body_roll_id=body.id),
    )
    assert response.status_code == 422


async def test_create_forbidden_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _seed_operator(db_session)
    product, body = await _seed_world(db_session, company.id)
    # Operator HAS cutting.write per the seed, so this should succeed.
    response = await authed_client.post(
        "/v1/cutting",
        json=_create_payload(product_id=product.id, body_roll_id=body.id),
    )
    assert response.status_code == 201


async def test_create_forbidden_for_no_permission(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    from models import Role

    role = Role(code=f"custom-no-cutting-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )
    product, body = await _seed_world(db_session, company.id)
    response = await authed_client.post(
        "/v1/cutting",
        json=_create_payload(product_id=product.id, body_roll_id=body.id),
    )
    assert response.status_code == 403


# ----------------------------------------------------------------- PATCH /{id}


async def test_patch_updates_status(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    product, body = await _seed_world(db_session, company.id)
    order = await create_cutting_order(db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id)
    response = await authed_client.patch(
        f"/v1/cutting/{order.id}",
        json={"status": "cutting"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "cutting"


async def test_patch_replaces_actuals(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    product, body = await _seed_world(db_session, company.id)
    order = await create_cutting_order(db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id)
    response = await authed_client.patch(
        f"/v1/cutting/{order.id}",
        json={
            "status": "cutting",
            "actual_outputs": [
                {"size": "m", "quantity": 5},
                {"size": "g", "quantity": 2},
            ],
        },
    )
    assert response.status_code == 200
    body_json = response.json()
    assert {o["size"] for o in body_json["actual_outputs"]} == {"m", "g"}


async def test_patch_returns_404_when_unknown(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.patch(
        f"/v1/cutting/{uuid.uuid4()}",
        json={"status": "cutting"},
    )
    assert response.status_code == 404


async def test_patch_returns_409_for_invalid_transition(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    product, body = await _seed_world(db_session, company.id)
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=body.id,
        status=CuttingStatus.DONE,
        cut_at=datetime.now(UTC),
    )
    response = await authed_client.patch(
        f"/v1/cutting/{order.id}",
        json={"status": "pending"},
    )
    assert response.status_code == 409


async def test_patch_forbidden_for_no_permission(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    from models import Role

    role = Role(code=f"custom-no-cutting-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )
    product, body = await _seed_world(db_session, company.id)
    order = await create_cutting_order(db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id)
    response = await authed_client.patch(
        f"/v1/cutting/{order.id}",
        json={"status": "cutting"},
    )
    assert response.status_code == 403


# ---------------------------------------------------------------- DELETE /{id}


async def test_delete_returns_204(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    product, body = await _seed_world(db_session, company.id)
    order = await create_cutting_order(db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id)
    response = await authed_client.delete(f"/v1/cutting/{order.id}")
    assert response.status_code == 204

    rows = (await db_session.exec(select(CuttingOrder).where(CuttingOrder.id == order.id))).all()
    assert list(rows) == []


async def test_delete_returns_404_when_unknown(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.delete(f"/v1/cutting/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_delete_returns_409_when_shipment_exists(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    product, body = await _seed_world(db_session, company.id)
    order = await create_cutting_order(db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id)
    contractor = await create_sewing_contractor(db_session, company_id=company.id)
    await create_sewing_shipment(
        db_session,
        company_id=company.id,
        cutting_order_id=order.id,
        contractor_id=contractor.id,
    )
    response = await authed_client.delete(f"/v1/cutting/{order.id}")
    assert response.status_code == 409
    assert "shipment" in response.json()["detail"].lower()


async def test_delete_forbidden_for_no_permission(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    from models import Role

    role = Role(code=f"custom-no-cutting-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )
    product, body = await _seed_world(db_session, company.id)
    order = await create_cutting_order(db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id)
    response = await authed_client.delete(f"/v1/cutting/{order.id}")
    assert response.status_code == 403


# ----------------------------------------------------------- Operator access


async def test_operator_can_list(authed_client: AsyncClient, db_session):
    company, _ = await _seed_operator(db_session)
    product, body = await _seed_world(db_session, company.id)
    await create_cutting_order(db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id)
    response = await authed_client.get("/v1/cutting")
    assert response.status_code == 200
    assert response.json()["total"] == 1


async def test_operator_can_get_detail(authed_client: AsyncClient, db_session):
    company, _ = await _seed_operator(db_session)
    product, body = await _seed_world(db_session, company.id)
    order = await create_cutting_order(db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id)
    response = await authed_client.get(f"/v1/cutting/{order.id}")
    assert response.status_code == 200
