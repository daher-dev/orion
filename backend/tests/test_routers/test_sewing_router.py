import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlmodel import select

from models import (
    SewingShipment,
    ShipmentStatus,
    Size,
    StockEntry,
)
from tests.factories import (
    create_company,
    create_cutting_order,
    create_fabric_roll,
    create_product,
    create_product_spec,
    create_product_variation,
    create_sewing_contractor,
    create_sewing_shipment,
    create_sewing_shipment_item,
    create_user,
    get_role_by_code,
)


async def _bootstrap_admin(db_session, *, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid=firebase_uid)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    for size in (Size.P, Size.M, Size.G):
        await create_product_variation(
            db_session,
            company_id=company.id,
            product_id=product.id,
            size=size,
            color="Preto",
            color_code="BLK",
        )
    roll = await create_fabric_roll(db_session, company_id=company.id)
    cutting = await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=roll.id,
    )
    contractor = await create_sewing_contractor(
        db_session,
        company_id=company.id,
        name="Banca Alpha",
    )
    return {
        "company": company,
        "user": user,
        "product": product,
        "cutting": cutting,
        "contractor": contractor,
    }


async def _bootstrap_operator(db_session):
    """Operator role has sewing.read + sewing.write per the migration seed."""

    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=operator_role.id,
        firebase_uid="qa-dev-user",
    )
    return company, user


async def _bootstrap_no_perms(db_session, *, code: str = "no-sewing-temp"):
    """Create a custom role with no sewing permissions for forbidden tests."""

    from models import Role

    company = await create_company(db_session)
    role = Role(name="No Sewing", code=code, description="test")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )
    return company, user


def _today_iso() -> str:
    return datetime.now(UTC).date().isoformat()


def _future_iso(days: int = 5) -> str:
    return (datetime.now(UTC).date() + timedelta(days=days)).isoformat()


# ---------- auth ----------


async def test_list_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/sewing")
    assert response.status_code == 401


async def test_create_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.post("/v1/sewing", json={})
    assert response.status_code == 401


async def test_receive_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.post(f"/v1/sewing/{uuid.uuid4()}/receive", json={})
    assert response.status_code == 401


async def test_cancel_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.post(f"/v1/sewing/{uuid.uuid4()}/cancel")
    assert response.status_code == 401


# ---------- GET / ----------


async def test_list_returns_empty_page(authed_client: AsyncClient, db_session):
    await _bootstrap_admin(db_session)
    response = await authed_client.get("/v1/sewing")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_list_returns_rows(authed_client: AsyncClient, db_session):
    ctx = await _bootstrap_admin(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=8,
    )

    response = await authed_client.get("/v1/sewing")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["contractor"]["name"] == "Banca Alpha"
    assert body["items"][0]["cutting_order"]["code"].startswith("OC-")


async def test_list_filter_by_status(authed_client: AsyncClient, db_session):
    ctx = await _bootstrap_admin(db_session)
    await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
        status=ShipmentStatus.SENT,
    )
    await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
        status=ShipmentStatus.CANCELLED,
    )

    response = await authed_client.get("/v1/sewing", params={"status": "cancelled"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["status"] == "cancelled"


async def test_list_filter_by_contractor(authed_client: AsyncClient, db_session):
    ctx = await _bootstrap_admin(db_session)
    other = await create_sewing_contractor(
        db_session,
        company_id=ctx["company"].id,
        name="Banca Bravo",
    )
    target = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=other.id,
    )
    await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )

    response = await authed_client.get(
        "/v1/sewing",
        params={"contractor_id": str(other.id)},
    )
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == str(target.id)


async def test_list_search_query_matches_contractor_name(
    authed_client: AsyncClient, db_session
):
    ctx = await _bootstrap_admin(db_session)
    other = await create_sewing_contractor(
        db_session,
        company_id=ctx["company"].id,
        name="Banca Charlie",
    )
    target = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=other.id,
    )
    await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )

    response = await authed_client.get("/v1/sewing", params={"q": "charlie"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == str(target.id)


async def test_list_does_not_leak_other_tenants(
    authed_client: AsyncClient, db_session
):
    await _bootstrap_admin(db_session)
    other = await create_company(db_session)
    other_spec = await create_product_spec(db_session, company_id=other.id)
    other_product = await create_product(db_session, company_id=other.id, spec_id=other_spec.id)
    other_roll = await create_fabric_roll(db_session, company_id=other.id)
    other_cutting = await create_cutting_order(
        db_session,
        company_id=other.id,
        product_id=other_product.id,
        body_roll_id=other_roll.id,
    )
    other_contractor = await create_sewing_contractor(
        db_session,
        company_id=other.id,
        name="Foreign",
    )
    await create_sewing_shipment(
        db_session,
        company_id=other.id,
        cutting_order_id=other_cutting.id,
        contractor_id=other_contractor.id,
    )

    response = await authed_client.get("/v1/sewing")
    body = response.json()
    assert body["total"] == 0


async def test_list_forbidden_without_sewing_read(
    authed_client: AsyncClient, db_session
):
    await _bootstrap_no_perms(db_session, code="no-sewing-list")
    response = await authed_client.get("/v1/sewing")
    assert response.status_code == 403


# ---------- GET /{id} ----------


async def test_get_returns_shipment(authed_client: AsyncClient, db_session):
    ctx = await _bootstrap_admin(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=6,
    )

    response = await authed_client.get(f"/v1/sewing/{shipment.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(shipment.id)
    assert body["status"] == "sent"
    assert len(body["items"]) == 1


async def test_get_returns_404_when_unknown(
    authed_client: AsyncClient, db_session
):
    await _bootstrap_admin(db_session)
    response = await authed_client.get(f"/v1/sewing/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_get_returns_404_for_other_tenant_row(
    authed_client: AsyncClient, db_session
):
    await _bootstrap_admin(db_session)
    other = await create_company(db_session)
    other_spec = await create_product_spec(db_session, company_id=other.id)
    other_product = await create_product(db_session, company_id=other.id, spec_id=other_spec.id)
    other_roll = await create_fabric_roll(db_session, company_id=other.id)
    other_cutting = await create_cutting_order(
        db_session,
        company_id=other.id,
        product_id=other_product.id,
        body_roll_id=other_roll.id,
    )
    other_contractor = await create_sewing_contractor(
        db_session,
        company_id=other.id,
        name="Foreign",
    )
    foreign = await create_sewing_shipment(
        db_session,
        company_id=other.id,
        cutting_order_id=other_cutting.id,
        contractor_id=other_contractor.id,
    )
    response = await authed_client.get(f"/v1/sewing/{foreign.id}")
    assert response.status_code == 404


# ---------- POST / ----------


async def test_create_success(authed_client: AsyncClient, db_session):
    ctx = await _bootstrap_admin(db_session)
    payload = {
        "cutting_order_id": str(ctx["cutting"].id),
        "contractor_id": str(ctx["contractor"].id),
        "sent_at": _today_iso(),
        "items": [
            {"size": "p", "requested_quantity": 4},
            {"size": "m", "requested_quantity": 10},
        ],
    }

    response = await authed_client.post("/v1/sewing", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "sent"
    assert len(body["items"]) == 2
    assert all(item["received_quantity"] == 0 for item in body["items"])

    rows = list(
        (
            await db_session.exec(
                select(SewingShipment).where(SewingShipment.company_id == ctx["company"].id)
            )
        ).all()
    )
    assert len(rows) == 1


async def test_create_rejects_empty_items(authed_client: AsyncClient, db_session):
    ctx = await _bootstrap_admin(db_session)
    payload = {
        "cutting_order_id": str(ctx["cutting"].id),
        "contractor_id": str(ctx["contractor"].id),
        "sent_at": _today_iso(),
        "items": [],
    }
    response = await authed_client.post("/v1/sewing", json=payload)
    assert response.status_code == 422


async def test_create_rejects_duplicate_sizes(
    authed_client: AsyncClient, db_session
):
    ctx = await _bootstrap_admin(db_session)
    payload = {
        "cutting_order_id": str(ctx["cutting"].id),
        "contractor_id": str(ctx["contractor"].id),
        "sent_at": _today_iso(),
        "items": [
            {"size": "m", "requested_quantity": 4},
            {"size": "m", "requested_quantity": 5},
        ],
    }
    response = await authed_client.post("/v1/sewing", json=payload)
    assert response.status_code == 422


async def test_create_404_for_unknown_contractor(
    authed_client: AsyncClient, db_session
):
    ctx = await _bootstrap_admin(db_session)
    payload = {
        "cutting_order_id": str(ctx["cutting"].id),
        "contractor_id": str(uuid.uuid4()),
        "sent_at": _today_iso(),
        "items": [{"size": "m", "requested_quantity": 3}],
    }
    response = await authed_client.post("/v1/sewing", json=payload)
    assert response.status_code == 404


async def test_create_forbidden_without_sewing_write(
    authed_client: AsyncClient, db_session
):
    company, _ = await _bootstrap_no_perms(db_session, code="no-sewing-write")
    # Even without sewing.write we need a cutting order for the payload —
    # so build references via the admin tenant. They will not match this
    # tenant, but permission check fires first.
    payload = {
        "cutting_order_id": str(uuid.uuid4()),
        "contractor_id": str(uuid.uuid4()),
        "sent_at": _today_iso(),
        "items": [{"size": "m", "requested_quantity": 1}],
    }
    response = await authed_client.post("/v1/sewing", json=payload)
    assert response.status_code == 403
    assert company.id is not None


# ---------- POST /{id}/receive ----------


async def test_receive_full_creates_stock_and_sets_received(
    authed_client: AsyncClient, db_session
):
    ctx = await _bootstrap_admin(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=5,
    )

    payload = {
        "received_at": _future_iso(7),
        "items": [{"size": "m", "received_quantity": 5}],
    }
    response = await authed_client.post(
        f"/v1/sewing/{shipment.id}/receive",
        json=payload,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "received"

    stock = list(
        (
            await db_session.exec(
                select(StockEntry).where(StockEntry.shipment_id == shipment.id)
            )
        ).all()
    )
    assert len(stock) == 1
    assert stock[0].quantity == 5


async def test_receive_partial_returns_partial_status(
    authed_client: AsyncClient, db_session
):
    ctx = await _bootstrap_admin(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=5,
    )

    payload = {
        "received_at": _today_iso(),
        "items": [{"size": "m", "received_quantity": 3}],
    }
    response = await authed_client.post(
        f"/v1/sewing/{shipment.id}/receive",
        json=payload,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "partial"


async def test_receive_409_when_over_delivery(
    authed_client: AsyncClient, db_session
):
    ctx = await _bootstrap_admin(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=5,
    )

    payload = {
        "received_at": _today_iso(),
        "items": [{"size": "m", "received_quantity": 9}],
    }
    response = await authed_client.post(
        f"/v1/sewing/{shipment.id}/receive",
        json=payload,
    )
    assert response.status_code == 409


async def test_receive_409_when_double_receive(
    authed_client: AsyncClient, db_session
):
    ctx = await _bootstrap_admin(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=2,
    )
    payload = {
        "received_at": _today_iso(),
        "items": [{"size": "m", "received_quantity": 2}],
    }
    first = await authed_client.post(
        f"/v1/sewing/{shipment.id}/receive",
        json=payload,
    )
    assert first.status_code == 200

    second = await authed_client.post(
        f"/v1/sewing/{shipment.id}/receive",
        json=payload,
    )
    assert second.status_code == 409


async def test_receive_404_when_unknown_shipment(
    authed_client: AsyncClient, db_session
):
    await _bootstrap_admin(db_session)
    payload = {
        "received_at": _today_iso(),
        "items": [{"size": "m", "received_quantity": 1}],
    }
    response = await authed_client.post(
        f"/v1/sewing/{uuid.uuid4()}/receive",
        json=payload,
    )
    assert response.status_code == 404


async def test_receive_forbidden_without_sewing_write(
    authed_client: AsyncClient, db_session
):
    company, _ = await _bootstrap_no_perms(db_session, code="no-sewing-receive")
    payload = {
        "received_at": _today_iso(),
        "items": [{"size": "m", "received_quantity": 1}],
    }
    response = await authed_client.post(
        f"/v1/sewing/{uuid.uuid4()}/receive",
        json=payload,
    )
    assert response.status_code == 403
    assert company.id is not None


# ---------- POST /{id}/cancel ----------


async def test_cancel_happy_path(authed_client: AsyncClient, db_session):
    ctx = await _bootstrap_admin(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=4,
    )

    response = await authed_client.post(f"/v1/sewing/{shipment.id}/cancel")
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


async def test_cancel_409_when_already_received(
    authed_client: AsyncClient, db_session
):
    ctx = await _bootstrap_admin(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
        status=ShipmentStatus.RECEIVED,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=4,
    )
    response = await authed_client.post(f"/v1/sewing/{shipment.id}/cancel")
    assert response.status_code == 409


async def test_cancel_404_when_unknown(
    authed_client: AsyncClient, db_session
):
    await _bootstrap_admin(db_session)
    response = await authed_client.post(f"/v1/sewing/{uuid.uuid4()}/cancel")
    assert response.status_code == 404


async def test_cancel_forbidden_without_sewing_write(
    authed_client: AsyncClient, db_session
):
    company, _ = await _bootstrap_no_perms(db_session, code="no-sewing-cancel")
    response = await authed_client.post(f"/v1/sewing/{uuid.uuid4()}/cancel")
    assert response.status_code == 403
    assert company.id is not None


async def test_operator_can_receive(authed_client: AsyncClient, db_session):
    """Operator role is seeded with sewing.read + sewing.write."""

    company, _ = await _bootstrap_operator(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    await create_product_variation(
        db_session,
        company_id=company.id,
        product_id=product.id,
        size=Size.M,
        color="Preto",
        color_code="BLK",
    )
    roll = await create_fabric_roll(db_session, company_id=company.id)
    cutting = await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=roll.id,
    )
    contractor = await create_sewing_contractor(
        db_session,
        company_id=company.id,
        name="OpBanca",
    )
    shipment = await create_sewing_shipment(
        db_session,
        company_id=company.id,
        cutting_order_id=cutting.id,
        contractor_id=contractor.id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=3,
    )

    response = await authed_client.post(
        f"/v1/sewing/{shipment.id}/receive",
        json={"received_at": _today_iso(), "items": [{"size": "m", "received_quantity": 3}]},
    )
    assert response.status_code == 200
