"""Sewing-shipment HTTP layer (thin)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import User
from models.enums import ShipmentStatus
from schemas._common import PageParams
from schemas.sewing import (
    ShipmentCreate,
    ShipmentFilters,
    ShipmentPage,
    ShipmentRead,
    ShipmentReceiveBody,
)
from services.sewing import (
    cancel_shipment,
    create_shipment,
    get_shipment,
    list_shipments,
    receive_shipment,
)

router = APIRouter(
    prefix="/sewing",
    tags=["Sewing"],
    dependencies=[Depends(RequirePermission("sewing.read"))],
)


@router.get("", response_model=ShipmentPage)
async def list_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("sewing.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    shipment_status: Annotated[
        ShipmentStatus | None,
        Query(alias="status"),
    ] = None,
    contractor_id: Annotated[uuid.UUID | None, Query()] = None,
    cutting_order_id: Annotated[uuid.UUID | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> ShipmentPage:
    params = PageParams(page=page, page_size=page_size)
    items, total = await list_shipments(
        db,
        company_id=user.company_id,
        filters=ShipmentFilters(
            q=q,
            status=shipment_status,
            contractor_id=contractor_id,
            cutting_order_id=cutting_order_id,
        ),
        page=params,
    )
    return ShipmentPage.build(items, total, params)


@router.get("/{shipment_id}", response_model=ShipmentRead)
async def get_endpoint(
    shipment_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("sewing.read"))],
) -> ShipmentRead:
    return await get_shipment(
        db,
        company_id=user.company_id,
        shipment_id=shipment_id,
    )


@router.post("", response_model=ShipmentRead, status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    payload: ShipmentCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("sewing.write"))],
) -> ShipmentRead:
    return await create_shipment(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )


@router.post("/{shipment_id}/receive", response_model=ShipmentRead)
async def receive_endpoint(
    shipment_id: uuid.UUID,
    payload: ShipmentReceiveBody,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("sewing.write"))],
) -> ShipmentRead:
    return await receive_shipment(
        db,
        company_id=user.company_id,
        user_id=user.id,
        shipment_id=shipment_id,
        payload=payload,
    )


@router.post("/{shipment_id}/cancel", response_model=ShipmentRead)
async def cancel_endpoint(
    shipment_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("sewing.write"))],
) -> ShipmentRead:
    return await cancel_shipment(
        db,
        company_id=user.company_id,
        user_id=user.id,
        shipment_id=shipment_id,
    )
