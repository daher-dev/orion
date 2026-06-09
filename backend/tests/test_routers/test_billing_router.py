"""Router tests for the billing endpoints.

- GET /v1/billing/summary  — tenant endpoint gated on billing.read.
- GET /v1/admin/plans      — operator-only catalog (router-level operator gate).
"""

import uuid

from httpx import AsyncClient

from models import Role
from models.enums import SubscriptionStatus
from tests.factories import (
    create_company,
    create_plan,
    create_subscription,
    create_user,
    get_role_by_code,
)


async def _seed_admin(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid=firebase_uid)
    return company, user


async def _provision_operator(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    await create_user(
        db_session,
        company_id=company.id,
        role_id=admin_role.id,
        firebase_uid=firebase_uid,
        is_operator=True,
    )
    return company


async def _provision_regular(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid=firebase_uid, is_operator=False)
    return company


# ---------- GET /v1/billing/summary ----------


async def test_summary_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/billing/summary")
    assert response.status_code == 401


async def test_summary_forbidden_without_billing_read(authed_client: AsyncClient, db_session):
    """A user on a role lacking billing.read receives 403."""
    company = await create_company(db_session)
    role = Role(code=f"custom-no-billing-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )

    response = await authed_client.get("/v1/billing/summary")
    assert response.status_code == 403


async def test_summary_returns_subscription_plan_and_usage(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)  # admin role has billing.read
    plan = await create_plan(
        db_session, slug="pro", name="Pro", price_cents=14900, max_members=10, max_orders_per_month=5000
    )
    await create_subscription(db_session, company_id=company.id, plan_id=plan.id, status=SubscriptionStatus.ACTIVE)

    response = await authed_client.get("/v1/billing/summary")
    assert response.status_code == 200
    body = response.json()

    assert body["plan"]["slug"] == "pro"
    assert body["plan"]["price"] == 149.0
    assert body["subscription"]["status"] == "active"
    assert body["subscription"]["persisted"] is True
    assert body["invoices"] == []

    usage_by_key = {u["key"]: u for u in body["usage"]}
    assert usage_by_key["members"]["used"] == 1  # the admin user itself
    assert usage_by_key["members"]["limit"] == 10
    assert usage_by_key["members"]["tracked"] is True
    assert usage_by_key["integrations"]["tracked"] is False
    assert usage_by_key["storage"]["tracked"] is False


async def test_summary_defaults_to_free_plan(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    await create_plan(db_session, slug="free", name="Grátis", price_cents=0, max_members=2)

    response = await authed_client.get("/v1/billing/summary")
    assert response.status_code == 200
    body = response.json()
    assert body["plan"]["slug"] == "free"
    assert body["subscription"]["status"] == "free"
    assert body["subscription"]["persisted"] is False


# ---------- GET /v1/admin/plans ----------


async def test_admin_plans_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/admin/plans")
    assert response.status_code == 401


async def test_admin_plans_forbidden_for_non_operator(authed_client: AsyncClient, db_session):
    await _provision_regular(db_session)
    response = await authed_client.get("/v1/admin/plans")
    assert response.status_code == 403


async def test_admin_plans_returns_catalog_for_operator(authed_client: AsyncClient, db_session):
    await _provision_operator(db_session)
    await create_plan(db_session, slug="free", name="Grátis", price_cents=0, sort_order=0)
    await create_plan(db_session, slug="pro", name="Pro", price_cents=14900, sort_order=1)

    response = await authed_client.get("/v1/admin/plans")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    slugs = [p["slug"] for p in body["items"]]
    assert slugs == ["free", "pro"]
    # cents → reais conversion surfaces in the response
    pro = next(p for p in body["items"] if p["slug"] == "pro")
    assert pro["price"] == 149.0
