"""HTTP layer for the Reports endpoints (FEATURE-015).

Exposes five read-only routes:

    GET /v1/reports/sales
    GET /v1/reports/production
    GET /v1/reports/inventory
    GET /v1/reports/costs
    GET /v1/reports/turnover

Permissions
-----------
Each route gates itself with a per-route ``RequirePermission``. The
sales/production/inventory/costs reports stay on ``orders.read`` (their v1
behaviour). The turnover ("giro") report is gated on ``stock.read`` since it
reads the stock ledger — that lets a stock-only role (operator) see giro
without granting them order visibility. A dedicated ``reports.*`` permission
domain is seeded for forward use but not yet enforced here.
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
    TurnoverReport,
)
from services import reports as reports_service

router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
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


@router.get("/turnover", response_model=TurnoverReport)
async def get_turnover_report_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("stock.read"))],
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
) -> TurnoverReport:
    return await reports_service.turnover_report(
        db,
        company_id=user.company_id,
        date_from=date_from,
        date_to=date_to,
    )
