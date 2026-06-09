"""HTTP integration tests for the Reports router — turnover ("giro") route.

Covers auth gating (stock.read), tenant context, and the date_from/date_to
query params. Uses dev-bypass auth (Firebase is never contacted).
"""

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient

from models import StockExitReason
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


async def _seed_admin(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    return company, user


async def _seed_operator(db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(db_session, company_id=company.id, role_id=operator_role.id, firebase_uid="qa-dev-user")
    return company, user


async def _make_variation(db_session, *, company_id: uuid.UUID):
    spec = await create_product_spec(db_session, company_id=company_id, code=f"FT{uuid.uuid4().hex[:6].upper()}")
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id)
    variation = await create_product_variation(
        db_session, company_id=company_id, product_id=product.id, sku=f"SKU-{uuid.uuid4().hex[:8].upper()}"
    )
    return spec, variation


async def test_turnover_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/reports/turnover")
    assert response.status_code == 401


async def test_turnover_admin_returns_200(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get("/v1/reports/turnover")
    assert response.status_code == 200
    body = response.json()
    assert "rows" in body
    assert "period_days" in body
    assert body["period_days"] == 30


async def test_turnover_operator_with_stock_read_returns_200(authed_client: AsyncClient, db_session):
    """Operator has stock.read (but not orders.read) and must reach turnover."""
    await _seed_operator(db_session)
    response = await authed_client.get("/v1/reports/turnover")
    assert response.status_code == 200


async def test_turnover_computes_rows_and_honors_date_params(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)

    now = datetime.now(UTC)
    date_from = now - timedelta(days=30)
    await create_stock_entry(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        quantity=20,
        created_at=date_from - timedelta(days=2),
    )
    await create_stock_exit(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        quantity=10,
        reason=StockExitReason.SALE,
        created_at=date_from + timedelta(days=5),
    )

    response = await authed_client.get(
        "/v1/reports/turnover",
        params={"date_from": date_from.isoformat(), "date_to": now.isoformat()},
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["rows"]) == 1
    row = body["rows"][0]
    assert row["sku"] == variation.sku
    assert row["units_sold"] == 10
    assert row["average_on_hand"] == 15.0
    assert row["turnover_ratio"] > 0
    assert row["days_inventory_outstanding"] is not None
    assert body["total_units_sold"] == 10


async def test_turnover_narrow_window_excludes_old_sales(authed_client: AsyncClient, db_session):
    """A 1-day window starting now excludes a sale made 5 days ago."""
    company, _ = await _seed_admin(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)

    now = datetime.now(UTC)
    await create_stock_entry(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        quantity=20,
        created_at=now - timedelta(days=10),
    )
    await create_stock_exit(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        quantity=10,
        reason=StockExitReason.SALE,
        created_at=now - timedelta(days=5),
    )

    date_from = now - timedelta(days=1)
    response = await authed_client.get(
        "/v1/reports/turnover",
        params={"date_from": date_from.isoformat(), "date_to": now.isoformat()},
    )
    assert response.status_code == 200
    body = response.json()
    # The variation still has on-hand stock (so it appears) but no in-window sales.
    assert body["total_units_sold"] == 0
    assert body["period_days"] == 1
    row = body["rows"][0]
    assert row["units_sold"] == 0
    assert row["turnover_ratio"] == 0
    assert row["days_inventory_outstanding"] is None
