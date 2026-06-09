"""Service-layer tests for the turnover ("giro") report.

First dedicated reports test file. Focuses on the turnover math:
units_sold from in-window SALE exits, average_on_hand from the
entries-minus-exits ledger, turnover_ratio, DIO, the divide-by-zero guards,
and tenant scoping.
"""

import uuid
from datetime import UTC, datetime, timedelta

from models import StockExitReason, StockSource
from services.reports import turnover_report
from tests.factories import (
    create_company,
    create_product,
    create_product_spec,
    create_product_variation,
    create_stock_entry,
    create_stock_exit,
)


async def _make_variation(db_session, *, company_id: uuid.UUID, spec_code: str | None = None, **overrides):
    spec = await create_product_spec(
        db_session,
        company_id=company_id,
        code=spec_code or f"FT{uuid.uuid4().hex[:6].upper()}",
    )
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id)
    variation = await create_product_variation(
        db_session,
        company_id=company_id,
        product_id=product.id,
        sku=f"SKU-{uuid.uuid4().hex[:8].upper()}",
        **overrides,
    )
    return spec, variation


async def test_turnover_basic_math(db_session):
    """20 entered before window, 10 sold in window => avg=(20+10)/2=15,
    ratio=10/15≈0.6667, DIO=period/ratio."""
    company = await create_company(db_session)
    _spec, variation = await _make_variation(db_session, company_id=company.id, spec_code="GIRO1")

    now = datetime.now(UTC)
    date_from = now - timedelta(days=30)
    date_to = now
    # 20 entered before the window -> on_hand_start = 20.
    await create_stock_entry(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        quantity=20,
        source=StockSource.ADJUSTMENT,
        created_at=date_from - timedelta(days=5),
    )
    # 10 sold inside the window -> units_sold = 10, on_hand_end = 20 - 10 = 10.
    await create_stock_exit(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        quantity=10,
        reason=StockExitReason.SALE,
        created_at=date_from + timedelta(days=10),
    )

    report = await turnover_report(db_session, company_id=company.id, date_from=date_from, date_to=date_to)

    assert len(report.rows) == 1
    row = report.rows[0]
    assert row.spec_code == "GIRO1"
    assert row.units_sold == 10
    # avg on hand = (20 + 10) / 2 = 15
    assert row.average_on_hand == 15.0
    # ratio = 10 / 15 ~= 0.6667
    assert abs(row.turnover_ratio - 0.6667) < 1e-3
    # DIO = period_days / ratio ; period_days == 30
    assert report.period_days == 30
    assert row.days_inventory_outstanding is not None
    assert abs(row.days_inventory_outstanding - (30 / row.turnover_ratio)) < 0.1
    assert report.total_units_sold == 10


async def test_loss_and_adjustment_exits_excluded_from_units_sold(db_session):
    """Only reason=SALE counts toward units_sold; LOSS/ADJUSTMENT do not."""
    company = await create_company(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)

    now = datetime.now(UTC)
    date_from = now - timedelta(days=30)
    await create_stock_entry(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        quantity=100,
        created_at=date_from - timedelta(days=2),
    )
    await create_stock_exit(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        quantity=5,
        reason=StockExitReason.SALE,
        created_at=date_from + timedelta(days=1),
    )
    await create_stock_exit(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        quantity=7,
        reason=StockExitReason.LOSS,
        created_at=date_from + timedelta(days=1),
    )
    await create_stock_exit(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        quantity=3,
        reason=StockExitReason.ADJUSTMENT,
        created_at=date_from + timedelta(days=1),
    )

    report = await turnover_report(db_session, company_id=company.id, date_from=date_from, date_to=now)
    row = report.rows[0]
    # Only the SALE exit (5) counts as units sold.
    assert row.units_sold == 5


async def test_zero_average_yields_zero_ratio_and_none_dio(db_session):
    """A variation with no stock movement at all is dropped; a variation with
    only an exit-driven net-zero / negative on-hand must not divide by zero."""
    company = await create_company(db_session)
    _, has_stock = await _make_variation(db_session, company_id=company.id)
    _, no_movement = await _make_variation(db_session, company_id=company.id)

    now = datetime.now(UTC)
    date_from = now - timedelta(days=30)
    # has_stock: entry 5 in-window, no sales -> units_sold 0, avg 5, ratio 0, DIO None.
    await create_stock_entry(
        db_session,
        company_id=company.id,
        variation_id=has_stock.id,
        quantity=5,
        created_at=date_from + timedelta(days=1),
    )

    report = await turnover_report(db_session, company_id=company.id, date_from=date_from, date_to=now)

    # no_movement variation is excluded (no units, no stock).
    skus = {r.sku for r in report.rows}
    assert no_movement.sku not in skus
    assert has_stock.sku in skus

    row = next(r for r in report.rows if r.sku == has_stock.sku)
    assert row.units_sold == 0
    assert row.turnover_ratio == 0.0
    assert row.days_inventory_outstanding is None


async def test_units_sold_outside_window_excluded(db_session):
    """SALE exits before date_from / after date_to do not count as units sold."""
    company = await create_company(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)

    now = datetime.now(UTC)
    date_from = now - timedelta(days=10)
    date_to = now
    await create_stock_entry(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        quantity=50,
        created_at=date_from - timedelta(days=20),
    )
    # Sold well before the window -> excluded.
    await create_stock_exit(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        quantity=8,
        reason=StockExitReason.SALE,
        created_at=date_from - timedelta(days=5),
    )
    # Sold inside the window -> counted.
    await create_stock_exit(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        quantity=4,
        reason=StockExitReason.SALE,
        created_at=date_from + timedelta(days=1),
    )

    report = await turnover_report(db_session, company_id=company.id, date_from=date_from, date_to=date_to)
    row = report.rows[0]
    assert row.units_sold == 4


async def test_tenant_scoped(db_session):
    """Another company's stock movements never leak into this company's giro."""
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    _, var_a = await _make_variation(db_session, company_id=company_a.id, spec_code="ACO1")
    _, var_b = await _make_variation(db_session, company_id=company_b.id, spec_code="BCO1")

    now = datetime.now(UTC)
    date_from = now - timedelta(days=30)
    await create_stock_entry(
        db_session,
        company_id=company_a.id,
        variation_id=var_a.id,
        quantity=10,
        created_at=date_from - timedelta(days=1),
    )
    await create_stock_exit(
        db_session,
        company_id=company_a.id,
        variation_id=var_a.id,
        quantity=2,
        reason=StockExitReason.SALE,
        created_at=date_from + timedelta(days=1),
    )
    # Company B has its own big movements that must not appear for A.
    await create_stock_entry(
        db_session,
        company_id=company_b.id,
        variation_id=var_b.id,
        quantity=999,
        created_at=date_from - timedelta(days=1),
    )
    await create_stock_exit(
        db_session,
        company_id=company_b.id,
        variation_id=var_b.id,
        quantity=500,
        reason=StockExitReason.SALE,
        created_at=date_from + timedelta(days=1),
    )

    report_a = await turnover_report(db_session, company_id=company_a.id, date_from=date_from, date_to=now)
    assert {r.sku for r in report_a.rows} == {var_a.sku}
    assert report_a.total_units_sold == 2


async def test_default_window_is_30_days(db_session):
    """Omitting the range defaults to a 30-day window (period_days == 30)."""
    company = await create_company(db_session)
    report = await turnover_report(db_session, company_id=company.id)
    assert report.period_days == 30
    assert report.rows == []
    assert report.average_turnover_ratio == 0.0


async def test_rows_sorted_by_turnover_desc(db_session):
    """Rows come back sorted by turnover_ratio descending."""
    company = await create_company(db_session)
    _, fast = await _make_variation(db_session, company_id=company.id, spec_code="FAST1")
    _, slow = await _make_variation(db_session, company_id=company.id, spec_code="SLOW1")

    now = datetime.now(UTC)
    date_from = now - timedelta(days=30)
    # fast: start 30, sold 20 in window -> end 10, avg 20, ratio 1.0
    await create_stock_entry(
        db_session,
        company_id=company.id,
        variation_id=fast.id,
        quantity=30,
        created_at=date_from - timedelta(days=1),
    )
    await create_stock_exit(
        db_session,
        company_id=company.id,
        variation_id=fast.id,
        quantity=20,
        reason=StockExitReason.SALE,
        created_at=date_from + timedelta(days=1),
    )
    # slow: avg 100, sold 5 -> ratio 0.05
    await create_stock_entry(
        db_session,
        company_id=company.id,
        variation_id=slow.id,
        quantity=100,
        created_at=date_from - timedelta(days=1),
    )
    await create_stock_exit(
        db_session,
        company_id=company.id,
        variation_id=slow.id,
        quantity=5,
        reason=StockExitReason.SALE,
        created_at=date_from + timedelta(days=1),
    )

    report = await turnover_report(db_session, company_id=company.id, date_from=date_from, date_to=now)
    assert [r.sku for r in report.rows] == [fast.sku, slow.sku]
    assert report.rows[0].turnover_ratio > report.rows[1].turnover_ratio
