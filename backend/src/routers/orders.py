"""Orders (Pedidos) HTTP router.

Thin layer over :mod:`services.order`. Every endpoint translates the
joined service result into the wire :class:`OrderRead` shape. Permissions
are enforced via a router-level ``orders.read`` dependency and an inline
``orders.write`` dependency on every mutation.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import Ecommerce, OrderStatus, User
from schemas._common import PageParams
from schemas.order import (
    OrderAdRead,
    OrderClientRead,
    OrderCreate,
    OrderFilters,
    OrderPage,
    OrderProductMini,
    OrderRead,
    OrderStatusTransition,
    OrderUpdate,
    OrderVariationRead,
)
from schemas.order_item import OrderItemRead
from schemas.separation import (
    GenerateLabelsResponse,
    ScanCheckRequest,
    ScanCheckResponse,
)
from services import order as order_service
from services import order_item as order_item_service

router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
    dependencies=[Depends(RequirePermission("orders.read"))],
)


def _to_read(
    row: order_service.OrderWithRelations,
    readiness: order_service.OrderReadiness,
) -> OrderRead:
    (
        order,
        ad,
        variation,
        product,
        spec_code,
        client,
        image_url,
        shipping_label_url,
        tracking_code,
    ) = row
    return OrderRead(
        id=order.id,
        ad=OrderAdRead(id=ad.id, title=ad.title, ecommerce=ad.ecommerce),
        variation=OrderVariationRead(
            id=variation.id,
            sku=variation.sku,
            size=variation.size,
            color=variation.color,
            color_code=variation.color_code,
            product=OrderProductMini(id=product.id, name=product.name, code=spec_code, image_url=image_url),
        ),
        client=(OrderClientRead(id=client.id, name=client.name, email=client.email) if client is not None else None),
        quantity=order.quantity,
        sale_price=order.sale_price,
        ordered_at=order.ordered_at,
        status=order.status,
        external_order_id=order.external_order_id,
        batch_id=order.batch_id,
        shipping_label_url=shipping_label_url,
        tracking_code=tracking_code,
        ready=readiness.ready,
        on_hand=readiness.on_hand,
        has_unmapped_items=readiness.has_unmapped_items,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


@router.get("", response_model=OrderPage)
async def list_orders_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    status_filter: Annotated[OrderStatus | None, Query(alias="status")] = None,
    channel: Annotated[Ecommerce | None, Query()] = None,
    client_id: Annotated[uuid.UUID | None, Query()] = None,
    ad_id: Annotated[uuid.UUID | None, Query()] = None,
    date_from: Annotated[datetime | None, Query()] = None,
    date_to: Annotated[datetime | None, Query()] = None,
    unbatched: Annotated[bool | None, Query()] = None,
    batch_id: Annotated[uuid.UUID | None, Query()] = None,
    product_id: Annotated[uuid.UUID | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> OrderPage:
    params = PageParams(page=page, page_size=page_size)
    filters = OrderFilters(
        q=q,
        status=status_filter,
        channel=channel,
        client_id=client_id,
        ad_id=ad_id,
        date_from=date_from,
        date_to=date_to,
        unbatched=unbatched,
        batch_id=batch_id,
        product_id=product_id,
    )
    rows, total, readiness = await order_service.list_orders(
        db,
        company_id=user.company_id,
        filters=filters,
        page=params,
    )
    items = [_to_read(row, readiness[row[0].id]) for row in rows]
    return OrderPage.build(items=items, total=total, params=params)


@router.post("/separation/scan", response_model=ScanCheckResponse)
async def scan_check_endpoint(
    payload: ScanCheckRequest,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> ScanCheckResponse:
    """Scan-to-check a separation piece by its label's tracking code.

    Declared before ``/{order_id}`` so the literal ``separation`` segment is
    not captured as an order id by the dynamic route.
    """
    return await order_item_service.scan_check(
        db,
        company_id=user.company_id,
        user_id=user.id,
        user_email=user.email,
        tracking_code=payload.tracking_code,
    )


@router.get("/{order_id}", response_model=OrderRead)
async def get_order_endpoint(
    order_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.read"))],
) -> OrderRead:
    row, readiness = await order_service.get_order(
        db,
        company_id=user.company_id,
        order_id=order_id,
    )
    return _to_read(row, readiness)


@router.get("/{order_id}/items", response_model=list[OrderItemRead])
async def list_order_items_endpoint(
    order_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.read"))],
) -> list[OrderItemRead]:
    items = await order_item_service.list_order_items(db, company_id=user.company_id, order_id=order_id)
    return [OrderItemRead.model_validate(item) for item in items]


@router.post("/{order_id}/labels", response_model=GenerateLabelsResponse)
async def generate_labels_endpoint(
    order_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> GenerateLabelsResponse:
    """Generate/print this order's separation labels (pending → label_printed).

    Lazily materializes one piece per unit of the order's quantity on first
    call; idempotent on re-print.
    """
    return await order_item_service.generate_labels(
        db,
        company_id=user.company_id,
        user_id=user.id,
        order_id=order_id,
    )


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
async def create_order_endpoint(
    payload: OrderCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> OrderRead:
    row, readiness = await order_service.create_order(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return _to_read(row, readiness)


@router.patch("/{order_id}", response_model=OrderRead)
async def update_order_endpoint(
    order_id: uuid.UUID,
    payload: OrderUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> OrderRead:
    row, readiness = await order_service.update_order(
        db,
        company_id=user.company_id,
        user_id=user.id,
        order_id=order_id,
        payload=payload,
    )
    return _to_read(row, readiness)


@router.post("/{order_id}/status", response_model=OrderRead)
async def transition_order_status_endpoint(
    order_id: uuid.UUID,
    payload: OrderStatusTransition,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> OrderRead:
    row, readiness = await order_service.transition_status(
        db,
        company_id=user.company_id,
        user_id=user.id,
        order_id=order_id,
        target=payload.status,
    )
    return _to_read(row, readiness)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order_endpoint(
    order_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> None:
    await order_service.delete_order(
        db,
        company_id=user.company_id,
        user_id=user.id,
        order_id=order_id,
    )
