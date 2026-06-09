"""De/Para mapping HTTP router (order-item → internal variation/SKU).

Thin layer over :mod:`services.mapping`. Reuses the ``orders.read`` /
``orders.write`` permissions — the De/Para is a view over order items and
mutating it just sets ``OrderItem.variation_id``.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from dependencies import DbSession, RequirePermission
from models import User
from schemas._common import PageParams
from schemas.mapping import (
    AcceptAllResult,
    MappingFilter,
    MappingItem,
    MappingItemsResponse,
    SetVariationBody,
)
from services import mapping as mapping_service

router = APIRouter(
    prefix="/mapping",
    tags=["Mapping"],
    dependencies=[Depends(RequirePermission("orders.read"))],
)


@router.get("/items", response_model=MappingItemsResponse)
async def list_items_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.read"))],
    mapping_filter: Annotated[MappingFilter, Query(alias="filter")] = MappingFilter.PENDING,
    q: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> MappingItemsResponse:
    params = PageParams(page=page, page_size=page_size)
    return await mapping_service.list_items(
        db,
        company_id=user.company_id,
        mapping_filter=mapping_filter,
        q=q,
        page=params,
    )


@router.post("/items/{item_id}/accept", response_model=MappingItem)
async def accept_suggestion_endpoint(
    item_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> MappingItem:
    return await mapping_service.accept_suggestion(
        db,
        company_id=user.company_id,
        user_id=user.id,
        item_id=item_id,
    )


@router.post("/accept-all", response_model=AcceptAllResult)
async def accept_all_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> AcceptAllResult:
    return await mapping_service.accept_all(
        db,
        company_id=user.company_id,
        user_id=user.id,
    )


@router.post("/items/{item_id}/variation", response_model=MappingItem)
async def set_variation_endpoint(
    item_id: uuid.UUID,
    payload: SetVariationBody,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> MappingItem:
    return await mapping_service.set_variation(
        db,
        company_id=user.company_id,
        user_id=user.id,
        item_id=item_id,
        variation_id=payload.variation_id,
    )
