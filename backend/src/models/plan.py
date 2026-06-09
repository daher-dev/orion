from sqlalchemy import CheckConstraint
from sqlmodel import Field

from models.base import BaseModel


class Plan(BaseModel, table=True):
    """A subscription plan in the GLOBAL Orion catalog.

    This is intentionally NOT a :class:`CompanyModel` — plans are platform-wide
    (the same four plans apply to every tenant) and must never be filtered by
    ``company_id``. Only :class:`~models.subscription.Subscription` ties a tenant
    to a plan.

    Money is stored as an integer ``price_cents`` (avoid float drift); the
    schema layer converts cents → reais for the UI.

    The four monthly limit columns are nullable, where ``NULL`` means
    *unlimited* (e.g. the Fábrica plan's members/orders). ``max_integrations``
    and ``max_storage_gb`` describe limits for domains Orion does not model yet
    — they shape the plan card, but live usage for those two is stubbed by the
    service (see ``services/billing.py``).
    """

    __tablename__ = "plans"
    __table_args__ = (
        CheckConstraint("price_cents >= 0", name="price_cents_non_negative"),
        CheckConstraint("max_members IS NULL OR max_members >= 0", name="max_members_non_negative"),
        CheckConstraint(
            "max_orders_per_month IS NULL OR max_orders_per_month >= 0",
            name="max_orders_per_month_non_negative",
        ),
        CheckConstraint(
            "max_integrations IS NULL OR max_integrations >= 0",
            name="max_integrations_non_negative",
        ),
        CheckConstraint("max_storage_gb IS NULL OR max_storage_gb >= 0", name="max_storage_gb_non_negative"),
    )

    # Stable machine key (e.g. "free", "atelie", "pro", "fabrica"). Unique.
    slug: str = Field(max_length=40, unique=True, index=True)
    name: str = Field(max_length=80)
    tagline: str | None = Field(default=None, max_length=160)

    price_cents: int = Field(default=0, ge=0)
    currency: str = Field(default="BRL", max_length=3)

    # Monthly limits. NULL == unlimited.
    max_members: int | None = Field(default=None, ge=0)
    max_orders_per_month: int | None = Field(default=None, ge=0)
    max_integrations: int | None = Field(default=None, ge=0)
    max_storage_gb: int | None = Field(default=None, ge=0)

    # Whether the plan is offered publicly (vs. legacy/grandfathered).
    is_public: bool = Field(default=True)
    # Display order in the catalog (cheapest first).
    sort_order: int = Field(default=0)
    active: bool = Field(default=True)
