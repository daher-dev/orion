"""Batches (Lotes de produção) HTTP router.

Thin layer over :mod:`services.batch`. Reuses the ``orders.read`` /
``orders.write`` permissions — a batch is a view over orders.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import Batch, User
from models.enums import BatchStatus
from schemas._common import PageParams
from schemas.batch import (
    BatchAssembleBody,
    BatchAssembleResult,
    BatchCreate,
    BatchDetailRead,
    BatchListItem,
    BatchPage,
    BatchRead,
    BatchStatusTransition,
)
from services import batch as batch_service

router = APIRouter(
    prefix="/batches",
    tags=["Batches"],
    dependencies=[Depends(RequirePermission("orders.read"))],
)


def _to_read(batch: Batch) -> BatchRead:
    return BatchRead.model_validate(batch, from_attributes=True)


@router.get("", response_model=BatchPage)
async def list_batches_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.read"))],
    status_filter: Annotated[BatchStatus | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> BatchPage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await batch_service.list_batches(
        db,
        company_id=user.company_id,
        status=status_filter,
        page=params,
    )
    items = [BatchListItem.model_validate(b) for b in rows]
    return BatchPage.build(items=items, total=total, params=params)


@router.post("", response_model=BatchRead, status_code=status.HTTP_201_CREATED)
async def create_batch_endpoint(
    payload: BatchCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> BatchRead:
    batch = await batch_service.create_batch(
        db,
        company_id=user.company_id,
        user_id=user.id,
        order_ids=payload.order_ids,
        name=payload.name,
    )
    return _to_read(batch)


@router.get("/{batch_id}", response_model=BatchDetailRead)
async def get_batch_endpoint(
    batch_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.read"))],
) -> BatchDetailRead:
    return await batch_service.get_batch_detail(db, company_id=user.company_id, batch_id=batch_id)


@router.post("/{batch_id}/assemble", response_model=BatchAssembleResult)
async def assemble_batch_endpoint(
    batch_id: uuid.UUID,
    payload: BatchAssembleBody,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> BatchAssembleResult:
    """Montar o lote — bulk-assemble the SKUs the batch is short on (reuses T5)."""
    return await batch_service.assemble_batch(
        db,
        company_id=user.company_id,
        user_id=user.id,
        batch_id=batch_id,
        payload=payload,
    )


@router.post("/{batch_id}/ship", response_model=BatchDetailRead)
async def ship_batch_endpoint(
    batch_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> BatchDetailRead:
    """Enviar o lote — ship member orders (T6 exits) and set status dispatched."""
    return await batch_service.ship_batch(
        db,
        company_id=user.company_id,
        user_id=user.id,
        batch_id=batch_id,
    )


@router.post("/{batch_id}/status", response_model=BatchRead)
async def transition_batch_endpoint(
    batch_id: uuid.UUID,
    payload: BatchStatusTransition,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> BatchRead:
    batch = await batch_service.transition_status(
        db,
        company_id=user.company_id,
        user_id=user.id,
        batch_id=batch_id,
        target=payload.status,
    )
    return _to_read(batch)


@router.delete("/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_batch_endpoint(
    batch_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> None:
    await batch_service.delete_batch(
        db,
        company_id=user.company_id,
        user_id=user.id,
        batch_id=batch_id,
    )
