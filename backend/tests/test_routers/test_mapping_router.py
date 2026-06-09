"""Router tests for the De/Para mapping endpoints (dev-bypass auth)."""

import uuid

from httpx import AsyncClient

from models import ImportedOrder, Size
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_order,
    create_order_item,
    create_print_design,
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
    """Operator role has neither orders.read nor orders.write — used for 403s."""

    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(db_session, company_id=company.id, role_id=operator_role.id, firebase_uid=firebase_uid)
    return company, user


async def _seed_pending(
    db_session,
    *,
    company_id,
    variation_text="Preto · M",
    external_order_id="EXT1",
    code="NRT01",
):
    """Seed a product with two variations + a pending order item.

    ``code`` is the print-design code AND the SKU prefix; pass distinct values
    when seeding more than one product within the same tenant to avoid the
    ``uq_print_designs_company_id_code`` / SKU unique-constraint collisions.
    """

    design = await create_print_design(db_session, company_id=company_id, code=code, name="Naruto")
    spec = await create_product_spec(db_session, company_id=company_id)
    product = await create_product(
        db_session, company_id=company_id, spec_id=spec.id, name="Camiseta Naruto", print_id=design.id
    )
    var_black_m = await create_product_variation(
        db_session,
        company_id=company_id,
        product_id=product.id,
        size=Size.M,
        color="Preto",
        color_code="PRT",
        sku=f"{code}-M-PRT",
    )
    var_white_g = await create_product_variation(
        db_session,
        company_id=company_id,
        product_id=product.id,
        size=Size.G,
        color="Branco",
        color_code="BCO",
        sku=f"{code}-G-BCO",
    )
    client = await create_client(db_session, company_id=company_id)
    ad = await create_ad(db_session, company_id=company_id, product_id=product.id, title="Camiseta Naruto")
    order = await create_order(
        db_session,
        company_id=company_id,
        ad_id=ad.id,
        variation_id=var_black_m.id,
        client_id=client.id,
        external_order_id=external_order_id,
    )
    item = await create_order_item(db_session, company_id=company_id, order_id=order.id, variation_id=None)
    db_session.add(
        ImportedOrder(
            company_id=company_id,
            order_id=order.id,
            marketplace="shopee",
            platform_order_id=f"SHP-{external_order_id}",
            ad_title="Camiseta Naruto Shippuden",
            sku="ADSKU-1",
            variation_text=variation_text,
            quantity=1,
        )
    )
    await db_session.commit()
    return item, var_black_m, var_white_g


async def test_list_items_requires_auth(async_client: AsyncClient):
    resp = await async_client.get("/v1/mapping/items")
    assert resp.status_code == 401


async def test_list_items_returns_pending_with_progress_and_suggestion(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _item, var_black_m, _ = await _seed_pending(db_session, company_id=company.id)

    resp = await authed_client.get("/v1/mapping/items", params={"filter": "pending"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 1
    assert body["progress"]["pending"] == 1
    assert body["progress"]["with_suggestion"] == 1
    row = body["items"][0]
    assert row["linked"] is False
    assert row["suggestion"]["sku"] == "NRT01-M-PRT"
    assert row["suggestion"]["variation_id"] == str(var_black_m.id)


async def test_accept_then_listed_as_linked(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    item, _vb, _ = await _seed_pending(db_session, company_id=company.id)

    resp = await authed_client.post(f"/v1/mapping/items/{item.id}/accept")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["linked"] is True
    assert body["sku"] == "NRT01-M-PRT"
    assert body["print_design_code"] == "NRT01"

    resp = await authed_client.get("/v1/mapping/items", params={"filter": "linked"})
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


async def test_accept_all_happy_path(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    await _seed_pending(
        db_session, company_id=company.id, variation_text="Preto · M", external_order_id="A1", code="NRT01"
    )
    await _seed_pending(
        db_session, company_id=company.id, variation_text="Branco · G", external_order_id="A2", code="GOK01"
    )

    resp = await authed_client.post("/v1/mapping/accept-all")
    assert resp.status_code == 200, resp.text
    assert resp.json()["accepted"] == 2

    resp = await authed_client.get("/v1/mapping/items", params={"filter": "pending"})
    assert resp.json()["total"] == 0


async def test_set_variation_swap_happy_path(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    item, _vb, var_white_g = await _seed_pending(db_session, company_id=company.id)

    resp = await authed_client.post(
        f"/v1/mapping/items/{item.id}/variation",
        json={"variation_id": str(var_white_g.id)},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["sku"] == "NRT01-G-BCO"


async def test_set_variation_unknown_item_404(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    _item, _vb, var_white_g = await _seed_pending(db_session, company_id=company.id)
    resp = await authed_client.post(
        f"/v1/mapping/items/{uuid.uuid4()}/variation",
        json={"variation_id": str(var_white_g.id)},
    )
    assert resp.status_code == 404


async def test_list_items_forbidden_for_role_without_orders_read(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    await _seed_pending(db_session, company_id=company.id)
    resp = await authed_client.get("/v1/mapping/items")
    assert resp.status_code == 403


async def test_accept_forbidden_for_role_without_orders_write(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    item, _vb, _vw = await _seed_pending(db_session, company_id=company.id)
    resp = await authed_client.post(f"/v1/mapping/items/{item.id}/accept")
    assert resp.status_code == 403
