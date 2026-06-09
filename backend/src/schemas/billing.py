"""Pydantic schemas for the Licensing / Billing domain.

Two read surfaces:
- ``BillingSummary`` — a single tenant's current plan + live usage + invoice
  stub (``GET /v1/billing/summary``).
- ``PlanRead`` / ``PlanList`` — the global plan catalog for the operator Console
  (``GET /v1/admin/plans``).

Money note: plans store an integer ``price_cents`` server-side; these schemas
expose ``price`` already converted to the major unit (reais) as a float so the
frontend's ``fmtBRL`` can format it directly.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from models.enums import SubscriptionStatus
from models.plan import Plan


class PlanRead(BaseModel):
    """A plan in the global catalog. ``None`` limits mean *unlimited*."""

    id: uuid.UUID
    slug: str
    name: str
    tagline: str | None
    price: float  # major unit (reais), converted from price_cents
    currency: str
    max_members: int | None
    max_orders_per_month: int | None
    max_integrations: int | None
    max_storage_gb: int | None
    is_public: bool
    sort_order: int
    active: bool

    @classmethod
    def from_plan(cls, plan: Plan) -> PlanRead:
        return cls(
            id=plan.id,
            slug=plan.slug,
            name=plan.name,
            tagline=plan.tagline,
            price=plan.price_cents / 100,
            currency=plan.currency,
            max_members=plan.max_members,
            max_orders_per_month=plan.max_orders_per_month,
            max_integrations=plan.max_integrations,
            max_storage_gb=plan.max_storage_gb,
            is_public=plan.is_public,
            sort_order=plan.sort_order,
            active=plan.active,
        )


class PlanList(BaseModel):
    items: list[PlanRead]
    total: int


class UsageMetric(BaseModel):
    """One usage dimension measured against the active plan's limit.

    ``limit is None`` → unlimited. ``tracked=False`` → Orion does not yet model
    this dimension (integrations, storage), so ``used`` is a placeholder and the
    UI should render it as "not tracked" rather than a real number.
    """

    key: str  # "members" | "orders_month" | "integrations" | "storage"
    used: int
    limit: int | None
    tracked: bool


class InvoiceStub(BaseModel):
    """Placeholder invoice shape. Payments are out of scope — the list is always
    empty for now, but the field exists so the contract is stable."""

    id: str
    period: str
    amount: float
    currency: str
    status: str


class SubscriptionRead(BaseModel):
    """The company's resolved subscription. ``persisted=False`` when the company
    has no Subscription row and is defaulted onto the free plan."""

    status: SubscriptionStatus
    period_start: datetime | None
    period_end: datetime | None
    cancel_at: datetime | None
    persisted: bool


class BillingSummary(BaseModel):
    plan: PlanRead
    subscription: SubscriptionRead
    usage: list[UsageMetric]
    invoices: list[InvoiceStub]
