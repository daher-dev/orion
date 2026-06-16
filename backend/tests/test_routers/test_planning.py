"""HTTP integration tests for the Planning (Planejamento) router — Phase 5.

Covers permission gating (401 unauth, 403 without perms, operator read-only vs
write), the suggestions read shape, the two bulk-create endpoints (PENDING orders
with no roll / paper), and tenant isolation.
"""

import uuid

from httpx import AsyncClient
from sqlmodel import select

from models import (
    ArtworkStatus,
    CuttingOrder,
    CuttingStatus,
    PrintOrder,
    PrintOrderStatus,
    Role,
    Size,
)
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_order,
    create_order_item,
    create_print_design,
    create_print_design_variation,
    create_product,
    create_product_spec,
    create_product_variation,
    create_user,
    get_role_by_code,
)

# --------------------------------------------------------------------- seeding


async def _seed_admin(db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    return company


async def _seed_operator(db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    await create_user(db_session, company_id=company.id, role_id=operator_role.id, firebase_uid="qa-dev-user")
    return company


async def _seed_no_permission(db_session):
    company = await create_company(db_session)
    role = Role(code=f"custom-no-plan-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="qa-dev-user")
    return company


async def _seed_demand(db_session, *, company, pieces=5, with_variation=False):
    """One order with ``pieces`` open items resolving to a (design, spec, PRT, M) SKU."""

    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01", name="Camiseta")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03", name="Floral")
    product = await create_product(
        db_session, company_id=company.id, spec_id=spec.id, print_id=design.id, name="Camiseta Floral"
    )
    variation = await create_product_variation(
        db_session,
        company_id=company.id,
        product_id=product.id,
        size=Size.M,
        color="Preto",
        color_code="PRT",
        sku="CAM01-M-PRT-FLR03",
    )
    if with_variation:
        await create_print_design_variation(
            db_session,
            company_id=company.id,
            print_design_id=design.id,
            front_status=ArtworkStatus.OK,
            front_file_url="https://x/ok.png",
        )
    client = await create_client(db_session, company_id=company.id)
    ad = await create_ad(db_session, company_id=company.id, product_id=product.id)
    order = await create_order(
        db_session, company_id=company.id, ad_id=ad.id, variation_id=variation.id, client_id=client.id, quantity=pieces
    )
    for index in range(pieces):
        await create_order_item(
            db_session, company_id=company.id, order_id=order.id, variation_id=variation.id, item_index=index
        )
    return spec, design


# ------------------------------------------------------------------------ auth


async def test_suggestions_unauthenticated_401(async_client: AsyncClient):
    response = await async_client.get("/v1/planning/suggestions")
    assert response.status_code == 401


async def test_suggestions_forbidden_without_permission(authed_client: AsyncClient, db_session):
    await _seed_no_permission(db_session)
    response = await authed_client.get("/v1/planning/suggestions")
    assert response.status_code == 403


async def test_operator_can_read_suggestions(authed_client: AsyncClient, db_session):
    company = await _seed_operator(db_session)
    await _seed_demand(db_session, company=company, pieces=3)
    response = await authed_client.get("/v1/planning/suggestions")
    assert response.status_code == 200
    assert response.json()["totals"]["toCut"] == 3


async def test_operator_cannot_create_cutting_orders_403(authed_client: AsyncClient, db_session):
    company = await _seed_operator(db_session)
    spec, _design = await _seed_demand(db_session, company=company, pieces=3)
    response = await authed_client.post("/v1/planning/cutting-orders", json={"keys": [f"{spec.id}|PRT"]})
    assert response.status_code == 403


# ----------------------------------------------------------------- suggestions


async def test_suggestions_shape(authed_client: AsyncClient, db_session):
    company = await _seed_admin(db_session)
    spec, design = await _seed_demand(db_session, company=company, pieces=5)
    response = await authed_client.get("/v1/planning/suggestions")
    assert response.status_code == 200
    body = response.json()

    assert {"skus", "cortes", "impressoes", "totals"} <= body.keys()
    assert body["totals"]["toCut"] == 5 and body["totals"]["toPrint"] == 5

    corte = next(c for c in body["cortes"] if c["key"] == f"{spec.id}|PRT")
    assert corte["total"] == 5 and corte["sources"] == ["demanda"]
    assert corte["grade_rows"] == [{"size": "m", "qty": 5, "demand_qty": 5, "stock_qty": 0}]
    assert corte["product_type"] == "camiseta"

    impressao = next(i for i in body["impressoes"] if i["key"] == str(design.id))
    assert impressao["total"] == 5 and impressao["png"] == "pending"

    sku = body["skus"][0]
    assert sku["needed"] == 5 and sku["net"] == 5 and sku["state"] == "ambos"


# --------------------------------------------------------------- create cutting


async def test_create_cutting_orders_201_pending_no_roll(authed_client: AsyncClient, db_session):
    company = await _seed_admin(db_session)
    spec, _design = await _seed_demand(db_session, company=company, pieces=4)
    response = await authed_client.post("/v1/planning/cutting-orders", json={"keys": [f"{spec.id}|PRT"]})
    assert response.status_code == 201
    body = response.json()
    assert body["created_count"] == 1
    assert body["created"][0]["total"] == 4
    assert body["created"][0]["code"].startswith("CO-")

    order = (await db_session.exec(select(CuttingOrder))).first()
    assert order.status == CuttingStatus.PENDING and order.body_roll_id is None

    # The new PENDING corte shows up on the Corte board.
    listing = await authed_client.get("/v1/cutting")
    statuses = [o["status"] for o in listing.json()["items"]]
    assert "pending" in statuses


async def test_create_cutting_orders_empty_keys_422(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post("/v1/planning/cutting-orders", json={"keys": []})
    assert response.status_code == 422


async def test_create_cutting_orders_stale_key_skipped(authed_client: AsyncClient, db_session):
    company = await _seed_admin(db_session)
    await _seed_demand(db_session, company=company, pieces=4)
    bogus = f"{uuid.uuid4()}|XYZ"
    response = await authed_client.post("/v1/planning/cutting-orders", json={"keys": [bogus]})
    assert response.status_code == 201
    body = response.json()
    assert body["created_count"] == 0
    assert body["skipped"] == [{"key": bogus, "reason": "stale"}]


# ----------------------------------------------------------------- create print


async def test_create_print_orders_201_pending_no_paper(authed_client: AsyncClient, db_session):
    company = await _seed_admin(db_session)
    _spec, design = await _seed_demand(db_session, company=company, pieces=6, with_variation=True)
    response = await authed_client.post("/v1/planning/print-orders", json={"keys": [str(design.id)]})
    assert response.status_code == 201
    body = response.json()
    assert body["created_count"] == 1
    assert body["created"][0]["total"] == 6
    assert body["created"][0]["code"].startswith("IM-")

    order = (await db_session.exec(select(PrintOrder))).first()
    assert order.status == PrintOrderStatus.PENDING and order.paper_roll_id is None


async def test_create_print_orders_no_variation_skipped(authed_client: AsyncClient, db_session):
    company = await _seed_admin(db_session)
    _spec, design = await _seed_demand(db_session, company=company, pieces=6, with_variation=False)
    response = await authed_client.post("/v1/planning/print-orders", json={"keys": [str(design.id)]})
    assert response.status_code == 201
    body = response.json()
    assert body["created_count"] == 0
    assert body["skipped"][0] == {"key": str(design.id), "reason": "no_variation"}


# ------------------------------------------------------------- tenant isolation


async def test_suggestions_tenant_scoped(authed_client: AsyncClient, db_session):
    company = await _seed_admin(db_session)
    await _seed_demand(db_session, company=company, pieces=5)
    other = await create_company(db_session)
    await _seed_demand(db_session, company=other, pieces=9)
    response = await authed_client.get("/v1/planning/suggestions")
    # Only this tenant's demand (5), not the other's (9).
    assert response.json()["totals"]["toCut"] == 5
