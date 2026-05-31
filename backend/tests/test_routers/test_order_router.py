import uuid
from datetime import UTC, datetime

from httpx import AsyncClient

from models import Ecommerce, OrderStatus
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_product,
    create_product_spec,
    create_product_variation,
    create_stock_exit,
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
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=operator_role.id,
        firebase_uid=firebase_uid,
    )
    return company, user


async def _seed_full_chain(db_session, *, company_id: uuid.UUID):
    spec = await create_product_spec(db_session, company_id=company_id)
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id)
    variation = await create_product_variation(db_session, company_id=company_id, product_id=product.id)
    ad = await create_ad(db_session, company_id=company_id, product_id=product.id)
    client = await create_client(db_session, company_id=company_id)
    return product, variation, ad, client, spec


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


# ---------- GET /v1/orders ----------


async def test_list_orders_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/orders")
    assert response.status_code == 401


async def test_list_orders_returns_only_tenant_rows(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    other = await create_company(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    _, other_variation, other_ad, other_client, _ = await _seed_full_chain(db_session, company_id=other.id)
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )
    await factory_create_order(
        db_session,
        company_id=other.id,
        ad_id=other_ad.id,
        variation_id=other_variation.id,
        client_id=other_client.id,
    )

    response = await authed_client.get("/v1/orders")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["client"]["id"] == str(client.id)


async def test_list_orders_filters_by_status(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PENDING,
        external_order_id="A",
    )
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PAID,
        external_order_id="B",
    )

    response = await authed_client.get("/v1/orders", params={"status": "paid"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["status"] == "paid"


async def test_list_orders_filters_by_channel(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    variation = await create_product_variation(db_session, company_id=company.id, product_id=product.id)
    ad_shopee = await create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        ecommerce=Ecommerce.SHOPEE,
    )
    ad_ig = await create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        ecommerce=Ecommerce.INSTAGRAM,
    )
    client = await create_client(db_session, company_id=company.id)
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad_shopee.id,
        variation_id=variation.id,
        client_id=client.id,
        external_order_id="S1",
    )
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad_ig.id,
        variation_id=variation.id,
        client_id=client.id,
        external_order_id="I1",
    )

    response = await authed_client.get("/v1/orders", params={"channel": "instagram"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["ad"]["ecommerce"] == "instagram"


async def test_list_orders_filters_by_client(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    other_client = await create_client(db_session, company_id=company.id)
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=other_client.id,
        external_order_id="O2",
    )

    response = await authed_client.get("/v1/orders", params={"client_id": str(other_client.id)})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["client"]["id"] == str(other_client.id)


async def test_list_orders_paginates(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    for i in range(3):
        await factory_create_order(
            db_session,
            company_id=company.id,
            ad_id=ad.id,
            variation_id=variation.id,
            client_id=client.id,
            external_order_id=f"E{i}",
        )

    response = await authed_client.get("/v1/orders", params={"page": 1, "page_size": 2})
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["has_more"] is True


# ---------- GET /v1/orders/{id} ----------


async def test_get_order_detail(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _, variation, ad, client, spec = await _seed_full_chain(db_session, company_id=company.id)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )

    response = await authed_client.get(f"/v1/orders/{order.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(order.id)
    assert body["ad"]["id"] == str(ad.id)
    assert body["client"]["id"] == str(client.id)
    assert body["variation"]["sku"] == variation.sku
    assert body["variation"]["product"]["code"] == spec.code


async def test_get_order_404_when_unknown(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.get(f"/v1/orders/{uuid.uuid4()}")
    assert response.status_code == 404


# ---------- POST /v1/orders ----------


async def test_create_order_201(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)

    response = await authed_client.post(
        "/v1/orders",
        json={
            "ad_id": str(ad.id),
            "variation_id": str(variation.id),
            "client_id": str(client.id),
            "quantity": 2,
            "sale_price": "149.00",
            "ordered_at": _now_iso(),
            "external_order_id": "S-EXT-1",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["quantity"] == 2
    assert body["status"] == "pending"


async def test_create_order_422_when_variation_wrong_product(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _, _, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    spec2 = await create_product_spec(db_session, company_id=company.id)
    other_product = await create_product(db_session, company_id=company.id, spec_id=spec2.id)
    other_variation = await create_product_variation(db_session, company_id=company.id, product_id=other_product.id)

    response = await authed_client.post(
        "/v1/orders",
        json={
            "ad_id": str(ad.id),
            "variation_id": str(other_variation.id),
            "client_id": str(client.id),
            "quantity": 1,
            "sale_price": "10.00",
            "ordered_at": _now_iso(),
        },
    )
    assert response.status_code == 422


async def test_create_order_409_when_duplicate_external_id(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        external_order_id="DUP",
    )

    response = await authed_client.post(
        "/v1/orders",
        json={
            "ad_id": str(ad.id),
            "variation_id": str(variation.id),
            "client_id": str(client.id),
            "quantity": 1,
            "sale_price": "10.00",
            "ordered_at": _now_iso(),
            "external_order_id": "DUP",
        },
    )
    assert response.status_code == 409


async def test_create_order_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)

    response = await authed_client.post(
        "/v1/orders",
        json={
            "ad_id": str(ad.id),
            "variation_id": str(variation.id),
            "client_id": str(client.id),
            "quantity": 1,
            "sale_price": "10.00",
            "ordered_at": _now_iso(),
        },
    )
    assert response.status_code == 403


async def test_create_order_401_anonymous(async_client: AsyncClient):
    response = await async_client.post(
        "/v1/orders",
        json={
            "ad_id": str(uuid.uuid4()),
            "variation_id": str(uuid.uuid4()),
            "client_id": str(uuid.uuid4()),
            "quantity": 1,
            "sale_price": "10.00",
            "ordered_at": _now_iso(),
        },
    )
    assert response.status_code == 401


# ---------- PATCH /v1/orders/{id} ----------


async def test_update_order_200(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )

    response = await authed_client.patch(
        f"/v1/orders/{order.id}",
        json={"sale_price": "199.50"},
    )
    assert response.status_code == 200
    assert response.json()["sale_price"] == "199.50"


async def test_update_order_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )

    response = await authed_client.patch(f"/v1/orders/{order.id}", json={"sale_price": "1"})
    assert response.status_code == 403


# ---------- POST /v1/orders/{id}/status ----------


async def test_transition_to_paid_200(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PENDING,
    )

    response = await authed_client.post(
        f"/v1/orders/{order.id}/status",
        json={"status": "paid"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "paid"


async def test_transition_to_shipped_writes_stock_exit(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PAID,
        quantity=4,
    )

    response = await authed_client.post(
        f"/v1/orders/{order.id}/status",
        json={"status": "shipped"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "shipped"

    # Confirm stock exit was written
    from sqlmodel import select

    from models import StockExit

    exits = (await db_session.exec(select(StockExit).where(StockExit.order_id == order.id))).all()
    assert len(exits) == 1
    assert exits[0].quantity == 4


async def test_transition_illegal_returns_409(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PENDING,
    )
    response = await authed_client.post(
        f"/v1/orders/{order.id}/status",
        json={"status": "delivered"},
    )
    assert response.status_code == 409


async def test_transition_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )
    response = await authed_client.post(
        f"/v1/orders/{order.id}/status",
        json={"status": "paid"},
    )
    assert response.status_code == 403


# ---------- DELETE /v1/orders/{id} ----------


async def test_delete_order_204(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )

    response = await authed_client.delete(f"/v1/orders/{order.id}")
    assert response.status_code == 204


async def test_delete_order_409_when_stock_moved(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.SHIPPED,
    )
    await create_stock_exit(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        order_id=order.id,
    )

    response = await authed_client.delete(f"/v1/orders/{order.id}")
    assert response.status_code == 409
    assert "stock" in response.json()["detail"].lower()


async def test_delete_order_404_when_unknown(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.delete(f"/v1/orders/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_delete_order_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )
    response = await authed_client.delete(f"/v1/orders/{order.id}")
    assert response.status_code == 403


async def test_delete_order_401_anonymous(async_client: AsyncClient, db_session):
    company = await create_company(db_session)
    _, variation, ad, client, _ = await _seed_full_chain(db_session, company_id=company.id)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )

    response = await async_client.delete(f"/v1/orders/{order.id}")
    assert response.status_code == 401
