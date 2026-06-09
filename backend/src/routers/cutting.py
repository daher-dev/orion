"""HTTP router for the Cutting (Corte) feature.

The router is intentionally thin: every endpoint defers to
:mod:`services.cutting` and converts the service result into the wire
schema. Permissions are enforced via a router-level ``cutting.read``
dependency and an inline ``cutting.write`` dependency on every mutation.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import CuttingStatus, User
from schemas._common import PageParams
from schemas.cutting import (
    CuttingCreate,
    CuttingFilters,
    CuttingPage,
    CuttingRead,
    CuttingUpdate,
)
from schemas.cutting_cost import CuttingCostRead
from services import cutting as cutting_service

router = APIRouter(
    prefix="/cutting",
    tags=["Cutting"],
    dependencies=[Depends(RequirePermission("cutting.read"))],
)


@router.get("", response_model=CuttingPage)
async def list_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("cutting.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    status_filter: Annotated[CuttingStatus | None, Query(alias="status")] = None,
    product_id: Annotated[uuid.UUID | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> CuttingPage:
    params = PageParams(page=page, page_size=page_size)
    items, total = await cutting_service.list_cutting_orders(
        db,
        company_id=user.company_id,
        filters=CuttingFilters(q=q, status=status_filter, product_id=product_id),
        page=params,
    )
    return CuttingPage.build(items, total, params)


@router.get("/{order_id}", response_model=CuttingRead)
async def get_endpoint(
    order_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("cutting.read"))],
) -> CuttingRead:
    return await cutting_service.get_cutting_order(
        db,
        company_id=user.company_id,
        order_id=order_id,
    )


@router.get("/{order_id}/cost", response_model=CuttingCostRead)
async def get_cost_endpoint(
    order_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("cutting.read"))],
) -> CuttingCostRead:
    return await cutting_service.get_cutting_cost(
        db,
        company_id=user.company_id,
        order_id=order_id,
    )


@router.post("", response_model=CuttingRead, status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    payload: CuttingCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("cutting.write"))],
) -> CuttingRead:
    return await cutting_service.create_cutting_order(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )


@router.patch("/{order_id}", response_model=CuttingRead)
async def update_endpoint(
    order_id: uuid.UUID,
    payload: CuttingUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("cutting.write"))],
) -> CuttingRead:
    return await cutting_service.update_cutting_order(
        db,
        company_id=user.company_id,
        user_id=user.id,
        order_id=order_id,
        payload=payload,
    )


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_endpoint(
    order_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("cutting.write"))],
) -> None:
    await cutting_service.delete_cutting_order(
        db,
        company_id=user.company_id,
        user_id=user.id,
        order_id=order_id,
    )
