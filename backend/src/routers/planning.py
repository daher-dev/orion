"""HTTP router for the Planning (Planejamento) feature — Phase 5.

Thin: every endpoint defers to :mod:`services.planning`. Read is gated by a
router-level ``planning.read`` dependency; the two bulk-create endpoints add an
inline ``planning.write`` dependency.

``GET /v1/planning/suggestions`` is a pure computed demand→production model (no
writes). ``POST /v1/planning/cutting-orders`` and ``…/print-orders`` recompute
the suggestions server-side and create **PENDING** orders for the selected keys
(no roll / no paper assigned), returning a created + skipped summary.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from dependencies import DbSession, RequirePermission
from models import User
from schemas.planning import (
    PlanningCutCreate,
    PlanningCutResult,
    PlanningPrintCreate,
    PlanningPrintResult,
    PlanningSuggestions,
)
from services import planning as planning_service

router = APIRouter(
    prefix="/planning",
    tags=["Planning"],
    dependencies=[Depends(RequirePermission("planning.read"))],
)


@router.get("/suggestions", response_model=PlanningSuggestions)
async def get_suggestions_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("planning.read"))],
) -> PlanningSuggestions:
    return await planning_service.build_suggestions(db, company_id=user.company_id)


@router.post("/cutting-orders", response_model=PlanningCutResult, status_code=status.HTTP_201_CREATED)
async def create_cutting_orders_endpoint(
    payload: PlanningCutCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("planning.write"))],
) -> PlanningCutResult:
    return await planning_service.create_cutting_orders(
        db,
        company_id=user.company_id,
        user_id=user.id,
        keys=payload.keys,
    )


@router.post("/print-orders", response_model=PlanningPrintResult, status_code=status.HTTP_201_CREATED)
async def create_print_orders_endpoint(
    payload: PlanningPrintCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("planning.write"))],
) -> PlanningPrintResult:
    return await planning_service.create_print_orders(
        db,
        company_id=user.company_id,
        user_id=user.id,
        keys=payload.keys,
    )
