"""HTTP layer for the Reports endpoints (FEATURE-015).

Exposes four read-only routes:

    GET /v1/reports/sales
    GET /v1/reports/production
    GET /v1/reports/inventory
    GET /v1/reports/costs

Permissions
-----------
Same provisional approach as :mod:`routers.dashboard`: gated on
``orders.read`` for v1 (no ``reports.read`` permission is seeded yet).
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from dependencies import DbSession, RequirePermission
from models import User
from schemas.reports import (
    CostsReport,
    InventoryReport,
    ProductionReport,
    SalesReport,
)
from services import reports as reports_service

router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
    dependencies=[Depends(RequirePermission("orders.read"))],
)


DateFromQ = Annotated[datetime | None, Query()]
DateToQ = Annotated[datetime | None, Query()]


@router.get("/sales", response_model=SalesReport)
async def get_sales_report_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.read"))],
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
) -> SalesReport:
    return await reports_service.sales_report(
        db,
        company_id=user.company_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/production", response_model=ProductionReport)
async def get_production_report_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.read"))],
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
) -> ProductionReport:
    return await reports_service.production_report(
        db,
        company_id=user.company_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/inventory", response_model=InventoryReport)
async def get_inventory_report_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.read"))],
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
) -> InventoryReport:
    return await reports_service.inventory_report(
        db,
        company_id=user.company_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/costs", response_model=CostsReport)
async def get_costs_report_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.read"))],
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
) -> CostsReport:
    return await reports_service.costs_report(
        db,
        company_id=user.company_id,
        date_from=date_from,
        date_to=date_to,
    )
