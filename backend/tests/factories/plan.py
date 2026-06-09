import uuid

from polyfactory import Use
from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Plan, Subscription
from models.enums import SubscriptionStatus


class PlanFactory(ModelFactory[Plan]):
    __model__ = Plan
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    slug = Use(lambda: f"plan-{uuid.uuid4().hex[:8]}")
    name = "Pro"
    tagline = "Confecções em crescimento"
    price_cents = 14900
    currency = "BRL"
    max_members = 10
    max_orders_per_month = 5000
    max_integrations = 8
    max_storage_gb = 10
    is_public = True
    sort_order = 0
    active = True


class SubscriptionFactory(ModelFactory[Subscription]):
    __model__ = Subscription
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    status = SubscriptionStatus.ACTIVE
    period_start = None
    period_end = None
    cancel_at = None


async def create_plan(db: AsyncSession, **overrides) -> Plan:
    """Create a Plan in the GLOBAL catalog (no company_id — plans are platform-wide)."""
    plan = PlanFactory.build(**overrides)
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


async def create_subscription(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    plan_id: uuid.UUID,
    **overrides,
) -> Subscription:
    subscription = SubscriptionFactory.build(company_id=company_id, plan_id=plan_id, **overrides)
    db.add(subscription)
    await db.commit()
    await db.refresh(subscription)
    return subscription
