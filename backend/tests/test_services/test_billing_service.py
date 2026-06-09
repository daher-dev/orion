"""Service-layer tests for the billing domain.

Note: the conftest truncates `plans` / `subscriptions` after each test (they are
not seed tables), so every test seeds its own plans via `create_plan`.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from models.enums import SubscriptionStatus
from services.billing import get_billing_summary, list_plans
from shared.exceptions import NotFoundError
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_order,
    create_plan,
    create_product,
    create_product_spec,
    create_product_variation,
    create_subscription,
    create_user,
)


async def _seed_order(db_session, company_id: uuid.UUID, *, ordered_at: datetime | None = None) -> None:
    spec = await create_product_spec(db_session, company_id=company_id)
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id)
    variation = await create_product_variation(db_session, company_id=company_id, product_id=product.id)
    ad = await create_ad(db_session, company_id=company_id, product_id=product.id)
    client = await create_client(db_session, company_id=company_id)
    overrides = {}
    if ordered_at is not None:
        overrides["ordered_at"] = ordered_at
    await create_order(
        db_session,
        company_id=company_id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        **overrides,
    )


def _usage(summary, key: str):
    return next(u for u in summary.usage if u.key == key)


# ---------- subscription resolution ----------


async def test_summary_returns_company_subscription_and_plan(db_session):
    company = await create_company(db_session)
    plan = await create_plan(db_session, slug="pro", name="Pro", price_cents=14900, max_members=10)
    await create_subscription(
        db_session,
        company_id=company.id,
        plan_id=plan.id,
        status=SubscriptionStatus.ACTIVE,
    )

    summary = await get_billing_summary(db_session, company_id=company.id)

    assert summary.plan.slug == "pro"
    assert summary.plan.name == "Pro"
    assert summary.plan.price == 149.0  # cents → reais
    assert summary.subscription.status == SubscriptionStatus.ACTIVE
    assert summary.subscription.persisted is True


async def test_summary_defaults_to_free_plan_when_no_subscription(db_session):
    company = await create_company(db_session)
    # Seed the free default plus a decoy paid plan to make sure we pick "free".
    await create_plan(db_session, slug="free", name="Grátis", price_cents=0, max_members=2)
    await create_plan(db_session, slug="pro", name="Pro", price_cents=14900)

    summary = await get_billing_summary(db_session, company_id=company.id)

    assert summary.plan.slug == "free"
    assert summary.subscription.status == SubscriptionStatus.FREE
    assert summary.subscription.persisted is False


async def test_summary_raises_when_default_plan_not_seeded(db_session):
    company = await create_company(db_session)
    # No plans at all (tables truncated). The default-plan fallback must fail loudly.
    with pytest.raises(NotFoundError):
        await get_billing_summary(db_session, company_id=company.id)


# ---------- usage counts ----------


async def test_member_usage_counts_only_this_company(db_session):
    company = await create_company(db_session)
    other = await create_company(db_session)
    plan = await create_plan(db_session, slug="free", price_cents=0, max_members=5)
    await create_subscription(db_session, company_id=company.id, plan_id=plan.id)

    # 2 members in our company, 3 in the other — only ours should count.
    await create_user(db_session, company_id=company.id)
    await create_user(db_session, company_id=company.id)
    await create_user(db_session, company_id=other.id)
    await create_user(db_session, company_id=other.id)
    await create_user(db_session, company_id=other.id)

    summary = await get_billing_summary(db_session, company_id=company.id)
    members = _usage(summary, "members")
    assert members.used == 2
    assert members.limit == 5
    assert members.tracked is True


async def test_orders_month_usage_is_tenant_scoped_and_current_month(db_session):
    company = await create_company(db_session)
    other = await create_company(db_session)
    plan = await create_plan(db_session, slug="free", price_cents=0, max_orders_per_month=50)
    await create_subscription(db_session, company_id=company.id, plan_id=plan.id)

    # 1 order this month for us, 1 last month (excluded), 1 for the other company.
    await _seed_order(db_session, company.id)
    last_month = datetime.now(UTC).replace(day=1) - timedelta(days=2)
    await _seed_order(db_session, company.id, ordered_at=last_month)
    await _seed_order(db_session, other.id)

    summary = await get_billing_summary(db_session, company_id=company.id)
    orders = _usage(summary, "orders_month")
    assert orders.used == 1
    assert orders.limit == 50


# ---------- stubbed dimensions + invoices ----------


async def test_integrations_and_storage_are_stubbed_not_tracked(db_session):
    company = await create_company(db_session)
    plan = await create_plan(db_session, slug="free", price_cents=0, max_integrations=1, max_storage_gb=1)
    await create_subscription(db_session, company_id=company.id, plan_id=plan.id)

    summary = await get_billing_summary(db_session, company_id=company.id)

    integrations = _usage(summary, "integrations")
    storage = _usage(summary, "storage")
    assert integrations.tracked is False
    assert integrations.used == 0
    assert integrations.limit == 1
    assert storage.tracked is False
    assert storage.used == 0
    assert storage.limit == 1


async def test_unlimited_limit_is_none(db_session):
    company = await create_company(db_session)
    plan = await create_plan(
        db_session,
        slug="fabrica",
        name="Fábrica",
        price_cents=34900,
        max_members=None,
        max_orders_per_month=None,
        max_integrations=None,
    )
    await create_subscription(db_session, company_id=company.id, plan_id=plan.id)

    summary = await get_billing_summary(db_session, company_id=company.id)
    assert _usage(summary, "members").limit is None
    assert _usage(summary, "orders_month").limit is None


async def test_invoices_are_empty_stub(db_session):
    company = await create_company(db_session)
    plan = await create_plan(db_session, slug="free", price_cents=0)
    await create_subscription(db_session, company_id=company.id, plan_id=plan.id)

    summary = await get_billing_summary(db_session, company_id=company.id)
    assert summary.invoices == []


# ---------- plan catalog (operator) ----------


async def test_list_plans_returns_active_plans_sorted(db_session):
    await create_plan(db_session, slug="pro", name="Pro", price_cents=14900, sort_order=2)
    await create_plan(db_session, slug="free", name="Grátis", price_cents=0, sort_order=0)
    await create_plan(db_session, slug="atelie", name="Ateliê", price_cents=7900, sort_order=1)

    plans = await list_plans(db_session)
    slugs = [p.slug for p in plans]
    assert slugs == ["free", "atelie", "pro"]


async def test_list_plans_excludes_inactive_by_default(db_session):
    await create_plan(db_session, slug="free", price_cents=0, sort_order=0, active=True)
    await create_plan(db_session, slug="legacy", price_cents=9900, sort_order=5, active=False)

    active_only = await list_plans(db_session)
    assert {p.slug for p in active_only} == {"free"}

    everything = await list_plans(db_session, include_inactive=True)
    assert {p.slug for p in everything} == {"free", "legacy"}
