"""HTTP router for the Print Orders (Impressão) feature — T4.

Thin: every endpoint defers to :mod:`services.print_order`. Permissions are
enforced via a router-level ``print_orders.read`` dependency and an inline
``print_orders.write`` dependency on every mutation. ``complete`` ("Lançar
impressos") is the T4 posting action — it debits paper meters and credits
printed transfers in one idempotent transaction.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import PrintOrderStatus, User
from schemas._common import PageParams
from schemas.print_order import (
    PrintOrderComplete,
    PrintOrderCreate,
    PrintOrderFilters,
    PrintOrderPage,
    PrintOrderRead,
    PrintOrderUpdate,
)
from services import print_order as print_order_service

router = APIRouter(
    prefix="/print-orders",
    tags=["Print Orders"],
    dependencies=[Depends(RequirePermission("print_orders.read"))],
)


@router.get("", response_model=PrintOrderPage)
async def list_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("print_orders.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    status_filter: Annotated[PrintOrderStatus | None, Query(alias="status")] = None,
    print_design_id: Annotated[uuid.UUID | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PrintOrderPage:
    params = PageParams(page=page, page_size=page_size)
    items, total = await print_order_service.list_print_orders(
        db,
        company_id=user.company_id,
        filters=PrintOrderFilters(q=q, status=status_filter, print_design_id=print_design_id),
        page=params,
    )
    return PrintOrderPage.build(items, total, params)


@router.get("/{order_id}", response_model=PrintOrderRead)
async def get_endpoint(
    order_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("print_orders.read"))],
) -> PrintOrderRead:
    return await print_order_service.get_print_order(
        db,
        company_id=user.company_id,
        order_id=order_id,
    )


@router.post("", response_model=PrintOrderRead, status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    payload: PrintOrderCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("print_orders.write"))],
) -> PrintOrderRead:
    return await print_order_service.create_print_order(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )


@router.patch("/{order_id}", response_model=PrintOrderRead)
async def update_endpoint(
    order_id: uuid.UUID,
    payload: PrintOrderUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("print_orders.write"))],
) -> PrintOrderRead:
    return await print_order_service.update_print_order(
        db,
        company_id=user.company_id,
        user_id=user.id,
        order_id=order_id,
        payload=payload,
    )


@router.post("/{order_id}/complete", response_model=PrintOrderRead)
async def complete_endpoint(
    order_id: uuid.UUID,
    payload: PrintOrderComplete,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("print_orders.write"))],
) -> PrintOrderRead:
    return await print_order_service.complete_print_order(
        db,
        company_id=user.company_id,
        user_id=user.id,
        order_id=order_id,
        payload=payload,
    )
