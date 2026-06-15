import uuid
from dataclasses import dataclass

from httpx import AsyncClient

from models import (
    BlankMovementKind,
    OrderStatus,
    PrintedMovementKind,
    PrintSide,
    PrintTechnique,
    Size,
)
from tests.factories import (
    create_ad,
    create_blank_piece,
    create_blank_piece_movement,
    create_client,
    create_company,
    create_print_design,
    create_printed_transfer,
    create_printed_transfer_movement,
    create_product,
    create_product_spec,
    create_product_variation,
    create_stock_entry,
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


@dataclass(slots=True)
class _Chain:
    spec: object
    design: object
    product: object
    variation: object
    ad: object
    client: object


async def _seed_chain(db_session, *, company_id: uuid.UUID):
    """Spec + DTF design + product(spec,design) + one M/BLK variation + ad/client."""

    spec = await create_product_spec(db_session, company_id=company_id, code="CAM01")
    design = await create_print_design(
        db_session, company_id=company_id, code="FLR03", technique=PrintTechnique.DTF, has_front=True
    )
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id, print_id=design.id)
    variation = await create_product_variation(
        db_session, company_id=company_id, product_id=product.id, size=Size.M, color="Preto", color_code="BLK"
    )
    ad = await create_ad(db_session, company_id=company_id, product_id=product.id)
    client = await create_client(db_session, company_id=company_id)
    return _Chain(spec=spec, design=design, product=product, variation=variation, ad=ad, client=client)


async def _chain_order(db_session, *, company_id, chain: _Chain, **overrides):
    return await factory_create_order(
        db_session,
        company_id=company_id,
        ad_id=chain.ad.id,
        variation_id=chain.variation.id,
        client_id=chain.client.id,
        **overrides,
    )


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


# --------------------------------------------------- detail grid + montar/enviar


async def test_get_batch_returns_estampa_grid(authed_client: AsyncClient, db_session):
    company, _user = await _provision_manager(db_session)
    chain = await _seed_chain(db_session, company_id=company.id)
    order = await _chain_order(db_session, company_id=company.id, chain=chain, quantity=5, external_order_id="A1")
    # 2 FRONT printed transfers on hand → to_print = max(0, 5 - 2) = 3.
    transfer = await create_printed_transfer(
        db_session, company_id=company.id, print_design_id=chain.design.id, side=PrintSide.FRONT
    )
    await create_printed_transfer_movement(
        db_session, company_id=company.id, printed_transfer_id=transfer.id, kind=PrintedMovementKind.ENTRY, quantity=2
    )

    resp = await authed_client.post("/v1/batches", json={"order_ids": [str(order.id)]})
    batch_id = resp.json()["id"]

    resp = await authed_client.get(f"/v1/batches/{batch_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["orders_total"] == 1
    assert body["pieces_total"] == 5
    assert len(body["estampas"]) == 1
    row = body["estampas"][0]
    assert row["code"] == "FLR03"
    assert row["items"] == 5
    assert row["to_print"] == 3
    assert row["montado"] == 0
    assert body["needs_assembly"] is True
    assert body["can_ship"] is False


async def test_assemble_endpoint_credits_finished(authed_client: AsyncClient, db_session):
    company, _user = await _provision_manager(db_session)
    chain = await _seed_chain(db_session, company_id=company.id)
    order = await _chain_order(db_session, company_id=company.id, chain=chain, quantity=4, external_order_id="A1")
    # Components: 10 blanks + 10 printed on hand.
    blank = await create_blank_piece(
        db_session, company_id=company.id, spec_id=chain.spec.id, size=Size.M, color="Preto", color_code="BLK"
    )
    await create_blank_piece_movement(
        db_session, company_id=company.id, blank_piece_id=blank.id, kind=BlankMovementKind.ENTRY, quantity=10
    )
    transfer = await create_printed_transfer(
        db_session, company_id=company.id, print_design_id=chain.design.id, side=PrintSide.FRONT
    )
    await create_printed_transfer_movement(
        db_session, company_id=company.id, printed_transfer_id=transfer.id, kind=PrintedMovementKind.ENTRY, quantity=10
    )

    resp = await authed_client.post("/v1/batches", json={"order_ids": [str(order.id)]})
    batch_id = resp.json()["id"]

    resp = await authed_client.post(f"/v1/batches/{batch_id}/assemble", json={})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["assembled"]) == 1
    assert body["assembled"][0]["quantity"] == 4
    assert body["skipped"] == []
    assert body["batch"]["status"] == "in_production"
    assert body["batch"]["estampas"][0]["montado"] == 4
    assert body["batch"]["orders_ready"] == 1


async def test_ship_endpoint_dispatches_and_debits(authed_client: AsyncClient, db_session):
    company, _user = await _provision_manager(db_session)
    chain = await _seed_chain(db_session, company_id=company.id)
    order = await _chain_order(
        db_session, company_id=company.id, chain=chain, quantity=3, status=OrderStatus.PAID, external_order_id="A1"
    )
    # Finished stock covers the order.
    await create_stock_entry(db_session, company_id=company.id, variation_id=chain.variation.id, quantity=3)

    resp = await authed_client.post("/v1/batches", json={"order_ids": [str(order.id)]})
    batch_id = resp.json()["id"]

    resp = await authed_client.post(f"/v1/batches/{batch_id}/ship", json={})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "dispatched"
    assert body["estampas"][0]["is_shipped"] is True

    # Order shipped + finished stock debited to 0.
    from sqlmodel import select

    from models import Order, StockExit

    o_db = (await db_session.exec(select(Order).where(Order.id == order.id))).first()
    assert o_db.status == OrderStatus.SHIPPED
    exits = list((await db_session.exec(select(StockExit).where(StockExit.order_id == order.id))).all())
    assert len(exits) == 1
    assert exits[0].quantity == 3


async def test_ship_endpoint_409_when_not_ready(authed_client: AsyncClient, db_session):
    company, _user = await _provision_manager(db_session)
    chain = await _seed_chain(db_session, company_id=company.id)
    order = await _chain_order(
        db_session, company_id=company.id, chain=chain, quantity=5, status=OrderStatus.PAID, external_order_id="A1"
    )
    # Only 2 finished — order needs 5.
    await create_stock_entry(db_session, company_id=company.id, variation_id=chain.variation.id, quantity=2)

    resp = await authed_client.post("/v1/batches", json={"order_ids": [str(order.id)]})
    batch_id = resp.json()["id"]

    resp = await authed_client.post(f"/v1/batches/{batch_id}/ship", json={})
    assert resp.status_code == 409


async def test_assemble_ship_forbidden_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    await _seed_order(db_session, company_id=company.id, external_order_id="A1")
    # Operator can't even create the batch; forge a batch id to hit the perm gate.
    fake_batch = uuid.uuid4()
    resp = await authed_client.post(f"/v1/batches/{fake_batch}/assemble", json={})
    assert resp.status_code == 403
    resp = await authed_client.post(f"/v1/batches/{fake_batch}/ship", json={})
    assert resp.status_code == 403
