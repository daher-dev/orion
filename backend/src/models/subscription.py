import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import SubscriptionStatus
from models.pg_enums import SUBSCRIPTION_STATUS


class Subscription(CompanyModel, table=True):
    """A tenant's billing subscription — which :class:`~models.plan.Plan` a
    company is on and the state of that subscription.

    One row per company (a partial unique index over ``company_id`` enforces a
    single subscription per tenant; the migration creates it). A company without
    a row is treated as being on the seeded default ``free`` plan — the service
    resolves that lazily rather than requiring a row to exist.

    Payments are out of scope, so ``period_start`` / ``period_end`` /
    ``cancel_at`` are descriptive only — nothing charges against them today.
    """

    __tablename__ = "subscriptions"
    __table_args__ = (
        # One subscription per company. (A partial-on-status design was avoided
        # since we keep a single row per tenant; the unique constraint is simple.)
        UniqueConstraint("company_id", name="uq_subscriptions_company_id"),
    )

    plan_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("plans.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    status: SubscriptionStatus = Field(default=SubscriptionStatus.FREE, sa_type=SUBSCRIPTION_STATUS)

    period_start: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    period_end: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    cancel_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
