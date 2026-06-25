"""HTTP layer for the Dashboard summary endpoint (FEATURE-015).

Single read-only endpoint:

    GET /v1/dashboard/summary

Permissions
-----------
No dedicated ``dashboard.read`` permission is seeded yet. We gate on
``orders.read`` for v1 — every admin/manager already holds it (and the
home page is meaningless without the orders module anyway). A future
follow-up migration should add a proper ``dashboard.read`` code.
"""

from __future__ import annotations

from datetime import UTC, datetime, time, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from dependencies import DbSession, RequirePermission
from models import User
from schemas.dashboard import DashboardSummary
from services import dashboard as dashboard_service

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
    dependencies=[Depends(RequirePermission("orders.read"))],
)


@router.get("/summary", response_model=DashboardSummary)
async def get_summary_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.read"))],
    days: Annotated[
        int | None,
        Query(ge=1, le=3650, description="Order-book window in days (e.g. 1, 7, 30). Omit for all history."),
    ] = None,
) -> DashboardSummary:
    """Return the panorama for the current tenant.

    ``days`` selects the date-range filter: the order-book panorama (conference
    totals + top products) is scoped to the last ``days`` days, counting from
    the start of today (UTC). Omitting it returns all history.
    """

    since: datetime | None = None
    if days is not None:
        start_today = datetime.combine(datetime.now(UTC).date(), time.min, tzinfo=UTC)
        since = start_today - timedelta(days=days - 1)
    return await dashboard_service.get_summary(db, company_id=user.company_id, since=since)
