"""Batches (Lotes de produção) HTTP router.

Thin layer over :mod:`services.batch`. Reuses the ``orders.read`` /
``orders.write`` permissions — a batch is a view over orders.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import User
from models.enums import BatchStatus
from schemas._common import PageParams
from schemas.batch import (
    BatchAdjustmentRead,
    BatchAdjustmentUpdate,
    BatchCreate,
    BatchListItem,
    BatchPage,
    BatchRead,
    BatchStatusTransition,
    MontadorSendResult,
    PrintQueueItem,
    PrintQueueRead,
)
from services import batch as batch_service
from services import montador as montador_service
from services.batch import BatchWithAdjustments

router = APIRouter(
    prefix="/batches",
    tags=["Batches"],
    dependencies=[Depends(RequirePermission("orders.read"))],
)


def _to_read(result: BatchWithAdjustments) -> BatchRead:
    batch, adjustments = result
    return BatchRead(
        id=batch.id,
        code=batch.code,
        name=batch.name,
        status=batch.status,
        total_orders=batch.total_orders,
        total_pieces=batch.total_pieces,
        labels_printed_at=batch.labels_printed_at,
        prints_sent_at=batch.prints_sent_at,
        completed_at=batch.completed_at,
        notes=batch.notes,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        adjustments=[
            BatchAdjustmentRead(
                print_design_id=adj.print_design_id,
                print_design_code=code,
                print_design_name=name,
                product_color=adj.product_color,
                qty_needed=adj.qty_needed,
                qty_stock=adj.qty_stock,
                qty_to_print=adj.qty_to_print,
                prints_sent=adj.prints_sent,
            )
            for adj, code, name in adjustments
        ],
    )


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
    result = await batch_service.create_batch(
        db,
        company_id=user.company_id,
        user_id=user.id,
        order_ids=payload.order_ids,
        name=payload.name,
    )
    return _to_read(result)


@router.get("/print-queue", response_model=PrintQueueRead)
async def print_queue_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.read"))],
) -> PrintQueueRead:
    """Cross-batch demand-driven print queue: what still needs printing now."""

    rows = await batch_service.list_print_queue(db, company_id=user.company_id)
    items = [PrintQueueItem(**row) for row in rows]
    return PrintQueueRead(
        items=items,
        total_to_print=sum(item.qty_to_print for item in items),
    )


@router.get("/{batch_id}", response_model=BatchRead)
async def get_batch_endpoint(
    batch_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.read"))],
) -> BatchRead:
    result = await batch_service.get_batch(db, company_id=user.company_id, batch_id=batch_id)
    return _to_read(result)


@router.patch("/{batch_id}/adjustments", response_model=BatchRead)
async def save_adjustments_endpoint(
    batch_id: uuid.UUID,
    payload: BatchAdjustmentUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> BatchRead:
    result = await batch_service.save_adjustments(
        db,
        company_id=user.company_id,
        user_id=user.id,
        batch_id=batch_id,
        adjustments=payload.adjustments,
    )
    return _to_read(result)


@router.post("/{batch_id}/status", response_model=BatchRead)
async def transition_batch_endpoint(
    batch_id: uuid.UUID,
    payload: BatchStatusTransition,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> BatchRead:
    result = await batch_service.transition_status(
        db,
        company_id=user.company_id,
        user_id=user.id,
        batch_id=batch_id,
        target=payload.status,
    )
    return _to_read(result)


@router.post("/{batch_id}/send-to-montador", response_model=MontadorSendResult)
async def send_to_montador_endpoint(
    batch_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> MontadorSendResult:
    result = await montador_service.send_batch_to_montador(
        db,
        company_id=user.company_id,
        user_id=user.id,
        batch_id=batch_id,
    )
    return MontadorSendResult(**result)


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
