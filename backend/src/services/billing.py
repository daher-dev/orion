"""Service layer for the Licensing / Billing domain.

Two responsibilities:

1. :func:`get_billing_summary` — a TENANT-scoped read: resolve the company's
   :class:`~models.subscription.Subscription` (lazily defaulting onto the seeded
   ``free`` plan when none exists), join the :class:`~models.plan.Plan`, and
   compute live usage. Member and orders-this-month counts reuse the exact
   pattern in ``services/admin.py`` but filtered to a single company. Integrations
   and storage have no backing model yet, so they are returned as stubbed,
   ``tracked=False`` metrics (used=0 / limit from the plan) rather than fabricated
   numbers. Invoices are a hard stub — payments are out of scope, so the list is
   always empty.

2. :func:`list_plans` — a CROSS-TENANT read for the operator Console. This is
   NOT company-scoped: it lists the global plan catalog. It must never be
   filtered by ``company_id``.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Order, Plan, Subscription, User
from models.enums import SubscriptionStatus
from schemas.billing import (
    BillingSummary,
    PlanRead,
    SubscriptionRead,
    UsageMetric,
)
from shared.exceptions import NotFoundError

# Slug of the no-cost plan a company falls back onto when it has no Subscription.
DEFAULT_PLAN_SLUG = "free"


def _start_of_month() -> datetime:
    now = datetime.now(UTC)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def _member_count(db: AsyncSession, company_id: uuid.UUID) -> int:
    stmt = select(func.count()).select_from(User).where(User.company_id == company_id)
    return int((await db.exec(stmt)).one())


async def _orders_month_count(db: AsyncSession, company_id: uuid.UUID) -> int:
    stmt = (
        select(func.count())
        .select_from(Order)
        .where(Order.company_id == company_id, Order.ordered_at >= _start_of_month())
    )
    return int((await db.exec(stmt)).one())


async def _resolve_plan_and_subscription(db: AsyncSession, company_id: uuid.UUID) -> tuple[Plan, Subscription | None]:
    """Return the company's (plan, subscription).

    When the company has a Subscription row, join its plan. Otherwise fall back
    to the seeded default ``free`` plan with no subscription row. Raises
    NotFoundError if neither a subscription nor the default plan can be resolved
    (i.e. the migration's plan seed never ran).
    """
    subscription = (await db.exec(select(Subscription).where(Subscription.company_id == company_id))).first()

    if subscription is not None:
        plan = (await db.exec(select(Plan).where(Plan.id == subscription.plan_id))).first()
        if plan is not None:
            return plan, subscription

    default_plan = (await db.exec(select(Plan).where(Plan.slug == DEFAULT_PLAN_SLUG))).first()
    if default_plan is None:  # pragma: no cover — seeded by migration
        raise NotFoundError(detail="No billing plan available — default plan not seeded")
    return default_plan, None


async def get_billing_summary(db: AsyncSession, *, company_id: uuid.UUID) -> BillingSummary:
    plan, subscription = await _resolve_plan_and_subscription(db, company_id)

    members = await _member_count(db, company_id)
    orders_month = await _orders_month_count(db, company_id)

    usage = [
        UsageMetric(key="members", used=members, limit=plan.max_members, tracked=True),
        UsageMetric(key="orders_month", used=orders_month, limit=plan.max_orders_per_month, tracked=True),
        # No backing model for these two yet — stubbed, not fabricated.
        UsageMetric(key="integrations", used=0, limit=plan.max_integrations, tracked=False),
        UsageMetric(key="storage", used=0, limit=plan.max_storage_gb, tracked=False),
    ]

    subscription_read = SubscriptionRead(
        status=subscription.status if subscription is not None else SubscriptionStatus.FREE,
        period_start=subscription.period_start if subscription is not None else None,
        period_end=subscription.period_end if subscription is not None else None,
        cancel_at=subscription.cancel_at if subscription is not None else None,
        persisted=subscription is not None,
    )

    return BillingSummary(
        plan=PlanRead.from_plan(plan),
        subscription=subscription_read,
        usage=usage,
        # Payments are out of scope — invoices are a hard, empty stub.
        invoices=[],
    )


async def list_plans(db: AsyncSession, *, include_inactive: bool = False) -> list[Plan]:
    """List the GLOBAL plan catalog for the operator Console.

    Cross-tenant: intentionally NOT scoped by ``company_id``. Ordered by
    ``sort_order`` (cheapest first) then price.
    """
    stmt = select(Plan)
    if not include_inactive:
        stmt = stmt.where(Plan.active.is_(True))  # type: ignore[attr-defined]
    stmt = stmt.order_by(Plan.sort_order.asc(), Plan.price_cents.asc())  # type: ignore[attr-defined]
    return list((await db.exec(stmt)).all())


__all__ = [
    "DEFAULT_PLAN_SLUG",
    "get_billing_summary",
    "list_plans",
]
