"""HTTP integration tests for the Stock router.

Covers permission gating, tenant isolation, validation, pagination, and the
negative-stock guard.
"""

import uuid
from datetime import date

from httpx import AsyncClient
from sqlmodel import select

from models import Role, StockEntry, StockExit, StockExitReason, StockSource
from tests.factories import (
    create_company,
    create_product,
    create_product_spec,
    create_product_variation,
    create_stock_entry,
    create_stock_exit,
    create_user,
    get_role_by_code,
)

# ---------- helpers ----------


async def _seed_admin(db_session):
    company = await create_company(db_session)
    user = await create_user(
        db_session,
        company_id=company.id,
        firebase_uid="qa-dev-user",
    )
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


async def _make_variation(db_session, *, company_id: uuid.UUID, **overrides):
    # Each call uses a unique spec code so the (company_id, spec_id, print_id)
    # unique constraint on `products` doesn't collide when a test creates
    # multiple variations in the same tenant.
    spec = await create_product_spec(db_session, company_id=company_id, code=f"FT{uuid.uuid4().hex[:6].upper()}")
    # Pin the product name to the variation's SKU. ProductFactory leaves
    # Product.name random, and /stock/levels search matches Product.name — a
    # random name can contain a test's search needle and flip an exact-count
    # assertion under --random-order. Naming the product after the SKU keeps
    # search deterministic.
    sku = overrides.pop("sku", None) or f"SKU-{uuid.uuid4().hex[:8].upper()}"
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id, name=sku)
    variation = await create_product_variation(
        db_session,
        company_id=company_id,
        product_id=product.id,
        sku=sku,
        **overrides,
    )
    return product, variation


# ---------- auth ----------


async def test_levels_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/stock/levels")
    assert response.status_code == 401


async def test_movements_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/stock/movements")
    assert response.status_code == 401


async def test_create_entry_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.post(
        "/v1/stock/entries",
        json={"variation_id": str(uuid.uuid4()), "quantity": 1},
    )
    assert response.status_code == 401


async def test_create_exit_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.post(
        "/v1/stock/exits",
        json={"variation_id": str(uuid.uuid4()), "quantity": 1},
    )
    assert response.status_code == 401


# ---------- GET /levels ----------


async def test_levels_empty(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get("/v1/stock/levels")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_levels_returns_on_hand_aggregate(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id, sku="CAM01-M-BLK")
    await create_stock_entry(db_session, company_id=company.id, variation_id=variation.id, quantity=15)
    await create_stock_exit(db_session, company_id=company.id, variation_id=variation.id, quantity=4)
    response = await authed_client.get("/v1/stock/levels")
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["sku"] == "CAM01-M-BLK"
    assert body["items"][0]["on_hand"] == 11
    assert body["items"][0]["entries_total"] == 15
    assert body["items"][0]["exits_total"] == 4


async def test_levels_filters_by_low_stock_only(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, low = await _make_variation(db_session, company_id=company.id, sku="LOW-M-BLK")
    _, ok = await _make_variation(db_session, company_id=company.id, sku="OK-M-BLK")
    await create_stock_entry(db_session, company_id=company.id, variation_id=low.id, quantity=2)
    await create_stock_entry(db_session, company_id=company.id, variation_id=ok.id, quantity=100)

    response = await authed_client.get(
        "/v1/stock/levels",
        params={"low_stock_only": True, "threshold": 5},
    )
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["sku"] == "LOW-M-BLK"


async def test_levels_filters_by_search(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, v1 = await _make_variation(db_session, company_id=company.id, sku="ABC-M-BLK")
    _, v2 = await _make_variation(db_session, company_id=company.id, sku="XYZ-M-BLK")
    await create_stock_entry(db_session, company_id=company.id, variation_id=v1.id, quantity=1)
    await create_stock_entry(db_session, company_id=company.id, variation_id=v2.id, quantity=1)
    response = await authed_client.get("/v1/stock/levels", params={"q": "abc"})
    body = response.json()
    assert body["total"] == 1


async def test_levels_filters_by_product_id(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    spec_a = await create_product_spec(db_session, company_id=company.id, code="SPEC-A")
    spec_b = await create_product_spec(db_session, company_id=company.id, code="SPEC-B")
    product_a = await create_product(db_session, company_id=company.id, spec_id=spec_a.id)
    product_b = await create_product(db_session, company_id=company.id, spec_id=spec_b.id)
    va = await create_product_variation(
        db_session,
        company_id=company.id,
        product_id=product_a.id,
        sku="A-M-BLK",
        color_code="BLK",
    )
    vb = await create_product_variation(
        db_session,
        company_id=company.id,
        product_id=product_b.id,
        sku="B-M-BLK",
        color_code="BLK",
    )
    await create_stock_entry(db_session, company_id=company.id, variation_id=va.id, quantity=1)
    await create_stock_entry(db_session, company_id=company.id, variation_id=vb.id, quantity=1)
    response = await authed_client.get("/v1/stock/levels", params={"product_id": str(product_a.id)})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["sku"] == "A-M-BLK"


async def test_levels_tenant_isolation(authed_client: AsyncClient, db_session):
    company_a, _ = await _seed_admin(db_session)
    company_b = await create_company(db_session)
    _, va = await _make_variation(db_session, company_id=company_a.id, sku="MINE-M-BLK")
    _, vb = await _make_variation(db_session, company_id=company_b.id, sku="THEIRS-M-BLK")
    await create_stock_entry(db_session, company_id=company_a.id, variation_id=va.id, quantity=1)
    await create_stock_entry(db_session, company_id=company_b.id, variation_id=vb.id, quantity=1)

    response = await authed_client.get("/v1/stock/levels")
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["sku"] == "MINE-M-BLK"


async def test_levels_pagination(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    for i in range(3):
        _, v = await _make_variation(db_session, company_id=company.id, sku=f"S{i}-M-BLK")
        await create_stock_entry(db_session, company_id=company.id, variation_id=v.id, quantity=1)
    response = await authed_client.get("/v1/stock/levels", params={"page_size": 2})
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["has_more"] is True


async def test_levels_forbidden_when_no_permission(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    role = Role(code=f"custom-no-stock-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )
    response = await authed_client.get("/v1/stock/levels")
    assert response.status_code == 403


# ---------- GET /movements ----------


async def test_movements_empty(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get("/v1/stock/movements")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_movements_returns_entries_and_exits(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=variation.id, quantity=10)
    await create_stock_exit(db_session, company_id=company.id, variation_id=variation.id, quantity=2)
    response = await authed_client.get("/v1/stock/movements")
    body = response.json()
    assert body["total"] == 2
    types = sorted(item["type"] for item in body["items"])
    assert types == ["entry", "exit"]


async def test_movements_filters_by_variation(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, v1 = await _make_variation(db_session, company_id=company.id, sku="V1-M-BLK")
    _, v2 = await _make_variation(db_session, company_id=company.id, sku="V2-M-BLK")
    await create_stock_entry(db_session, company_id=company.id, variation_id=v1.id, quantity=1)
    await create_stock_entry(db_session, company_id=company.id, variation_id=v2.id, quantity=1)
    response = await authed_client.get("/v1/stock/movements", params={"variation_id": str(v1.id)})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["variation_id"] == str(v1.id)


async def test_movements_filters_by_type(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, v = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=v.id, quantity=3)
    await create_stock_exit(db_session, company_id=company.id, variation_id=v.id, quantity=1)
    response = await authed_client.get("/v1/stock/movements", params={"type": "entry"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["type"] == "entry"


async def test_movements_filters_by_reason_or_source(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, v = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(
        db_session,
        company_id=company.id,
        variation_id=v.id,
        quantity=3,
        source=StockSource.SHIPMENT,
    )
    await create_stock_entry(
        db_session,
        company_id=company.id,
        variation_id=v.id,
        quantity=4,
        source=StockSource.ADJUSTMENT,
    )
    response = await authed_client.get("/v1/stock/movements", params={"reason_or_source": "adjustment"})
    body = response.json()
    # Both the entry-adjustment AND any exit-adjustment match — but no exits exist here.
    assert body["total"] == 1
    assert body["items"][0]["source"] == "adjustment"


# ---------- POST /entries ----------


async def test_create_entry_success(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id, sku="CAM01-M-BLK")
    response = await authed_client.post(
        "/v1/stock/entries",
        json={"variation_id": str(variation.id), "quantity": 12, "notes": "Found"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["sku"] == "CAM01-M-BLK"
    assert body["quantity"] == 12
    assert body["source"] == "adjustment"
    assert body["notes"] == "Found"

    rows = (await db_session.exec(select(StockEntry).where(StockEntry.variation_id == variation.id))).all()
    assert len(list(rows)) == 1


async def test_create_entry_invalid_quantity_returns_422(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/stock/entries",
        json={"variation_id": str(variation.id), "quantity": 0},
    )
    assert response.status_code == 422


async def test_create_entry_unknown_variation_returns_404(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post(
        "/v1/stock/entries",
        json={"variation_id": str(uuid.uuid4()), "quantity": 1},
    )
    assert response.status_code == 404


async def test_create_entry_other_tenant_variation_returns_404(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    other = await create_company(db_session)
    _, foreign = await _make_variation(db_session, company_id=other.id)

    response = await authed_client.post(
        "/v1/stock/entries",
        json={"variation_id": str(foreign.id), "quantity": 1},
    )
    assert response.status_code == 404


async def test_create_entry_with_explicit_source(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/stock/entries",
        json={"variation_id": str(variation.id), "quantity": 5, "source": "return"},
    )
    assert response.status_code == 201
    assert response.json()["source"] == "return"


async def test_operator_can_create_entry(authed_client: AsyncClient, db_session):
    """Operators hold stock.write — they must be able to record adjustments."""
    company, _ = await _seed_operator(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/stock/entries",
        json={"variation_id": str(variation.id), "quantity": 3},
    )
    assert response.status_code == 201


async def test_create_entry_forbidden_when_no_permission(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    role = Role(code=f"custom-no-stock-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )
    response = await authed_client.post(
        "/v1/stock/entries",
        json={"variation_id": str(uuid.uuid4()), "quantity": 1},
    )
    assert response.status_code == 403


# ---------- POST /exits ----------


async def test_create_exit_success(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id, sku="CAM01-M-BLK")
    await create_stock_entry(db_session, company_id=company.id, variation_id=variation.id, quantity=10)
    response = await authed_client.post(
        "/v1/stock/exits",
        json={
            "variation_id": str(variation.id),
            "quantity": 4,
            "reason": "loss",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["sku"] == "CAM01-M-BLK"
    assert body["quantity"] == 4
    assert body["reason"] == "loss"
    assert body["order"] is None

    rows = (await db_session.exec(select(StockExit).where(StockExit.variation_id == variation.id))).all()
    assert len(list(rows)) == 1


async def test_create_exit_returns_409_on_insufficient_stock(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=variation.id, quantity=3)
    response = await authed_client.post(
        "/v1/stock/exits",
        json={"variation_id": str(variation.id), "quantity": 10},
    )
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert "insufficient" in detail.lower()
    assert "3" in detail


async def test_create_exit_returns_404_when_unknown_variation(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post(
        "/v1/stock/exits",
        json={"variation_id": str(uuid.uuid4()), "quantity": 1},
    )
    assert response.status_code == 404


async def test_create_exit_invalid_quantity_returns_422(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/stock/exits",
        json={"variation_id": str(variation.id), "quantity": -1},
    )
    assert response.status_code == 422


async def test_operator_can_create_exit(authed_client: AsyncClient, db_session):
    company, _ = await _seed_operator(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=variation.id, quantity=5)
    response = await authed_client.post(
        "/v1/stock/exits",
        json={"variation_id": str(variation.id), "quantity": 2},
    )
    assert response.status_code == 201


# Pin reference type usage so flake8/ruff don't strip imports.
_ = (date, StockExitReason)
