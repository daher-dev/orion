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

from typing import Annotated

from fastapi import APIRouter, Depends

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
) -> DashboardSummary:
    """Return the panorama for the current tenant."""

    return await dashboard_service.get_summary(db, company_id=user.company_id)
