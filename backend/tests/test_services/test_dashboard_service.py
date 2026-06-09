"""Service-layer tests for the dashboard summary, focused on the configurable
low-stock threshold (stock_low KPI + the stock_low needs-action item).

There was previously no dashboard test, so this also backfills basic coverage of
the low-stock counting path.
"""

import uuid

from services.dashboard import get_summary
from tests.factories import (
    create_company,
    create_product,
    create_product_spec,
    create_product_variation,
    create_stock_entry,
)


async def _make_variation(db_session, *, company_id: uuid.UUID, **overrides):
    spec = await create_product_spec(db_session, company_id=company_id, code=f"FT{uuid.uuid4().hex[:6].upper()}")
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id)
    return await create_product_variation(
        db_session,
        company_id=company_id,
        product_id=product.id,
        sku=f"SKU-{uuid.uuid4().hex[:8].upper()}",
        **overrides,
    )


async def test_low_stock_uses_default_threshold(db_session):
    """on_hand 8 <= default 10 -> low; on_hand 50 -> ok."""
    company = await create_company(db_session)  # default threshold 10
    low = await _make_variation(db_session, company_id=company.id)
    ok = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=low.id, quantity=8)
    await create_stock_entry(db_session, company_id=company.id, variation_id=ok.id, quantity=50)

    summary = await get_summary(db_session, company_id=company.id)
    assert summary.kpis.stock_low.value == 1.0


async def test_custom_company_threshold_makes_sku_low(db_session):
    """With on_hand 8: default 10 already flags it; raise threshold to 30 so a
    previously-OK 25 also becomes low, proving the company value is honored."""
    company = await create_company(db_session, low_stock_threshold=30)
    v = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=v.id, quantity=25)

    summary = await get_summary(db_session, company_id=company.id)
    assert summary.kpis.stock_low.value == 1.0

    # And surfaced as a needs-action item.
    kinds = [item.kind for item in summary.needs_action]
    assert "stock_low" in kinds


async def test_company_threshold_excludes_above_value(db_session):
    """on_hand 25 with default company threshold 10 -> not low."""
    company = await create_company(db_session)  # default 10
    v = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=v.id, quantity=25)

    summary = await get_summary(db_session, company_id=company.id)
    assert summary.kpis.stock_low.value == 0.0


async def test_variation_override_takes_precedence(db_session):
    """Company default 10 would NOT flag on_hand 25, but a per-variation
    override of 30 must flag it; another variation without override stays OK."""
    company = await create_company(db_session, low_stock_threshold=10)
    overridden = await _make_variation(db_session, company_id=company.id, low_stock_threshold=30)
    inherits = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=overridden.id, quantity=25)
    await create_stock_entry(db_session, company_id=company.id, variation_id=inherits.id, quantity=25)

    summary = await get_summary(db_session, company_id=company.id)
    # Only the overridden variation (25 <= 30) is low; the inheriting one (25 > 10) is not.
    assert summary.kpis.stock_low.value == 1.0


async def test_variation_override_can_exclude_otherwise_low_sku(db_session):
    """Company default 10 flags on_hand 8, but a per-variation override of 5
    rescues it (8 > 5 -> not low)."""
    company = await create_company(db_session, low_stock_threshold=10)
    v = await _make_variation(db_session, company_id=company.id, low_stock_threshold=5)
    await create_stock_entry(db_session, company_id=company.id, variation_id=v.id, quantity=8)

    summary = await get_summary(db_session, company_id=company.id)
    assert summary.kpis.stock_low.value == 0.0
