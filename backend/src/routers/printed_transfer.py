"""HTTP surface for the Printed Transfers (estampados) WIP inventory tier.

Replaces the old ``print_stock`` router. The surface uses a single ``/movements``
POST with a ``kind`` enum (matching supply), keyed by ``printed_transfer_id`` (a
real FK), not the old free-text ``product_color`` + split entry/exit POSTs.

Layout
------
- GET  /printed-transfers/levels    — printed-transfer on-hand aggregate (every row).
- GET  /printed-transfers/movements — append-only ledger (paginated, filterable).
- POST /printed-transfers/movements — append a movement (entry / exit / adjustment).
- POST /printed-transfers           — create an empty catalog row (new key).

The router enforces ``printed_stock.read`` at the include level;
``printed_stock.write`` is required inline on the mutations.
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import PrintedMovementKind, PrintSide, User
from schemas._common import PageParams
from schemas.printed_transfer import (
    PrintedMovementCreate,
    PrintedMovementFilters,
    PrintedMovementPage,
    PrintedMovementRead,
    PrintedTransferCreate,
    PrintedTransferLevelFilters,
    PrintedTransferLevelPage,
    PrintedTransferLevelRead,
)
from services.printed_transfer import (
    create_movement,
    create_printed_transfer,
    list_levels,
    list_movements,
)

router = APIRouter(
    prefix="/printed-transfers",
    tags=["Printed Transfers"],
    dependencies=[Depends(RequirePermission("printed_stock.read"))],
)


# ---------- GET /printed-transfers/levels ----------


@router.get("/levels", response_model=PrintedTransferLevelPage)
async def list_levels_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("printed_stock.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    print_design_id: Annotated[uuid.UUID | None, Query()] = None,
    side: Annotated[PrintSide | None, Query()] = None,
    low_stock_only: Annotated[bool, Query()] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PrintedTransferLevelPage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_levels(
        db,
        company_id=user.company_id,
        filters=PrintedTransferLevelFilters(
            q=q, print_design_id=print_design_id, side=side, low_stock_only=low_stock_only
        ),
        page=params,
    )
    items = [PrintedTransferLevelRead(**row) for row in rows]
    return PrintedTransferLevelPage.build(items, total, params)


# ---------- GET /printed-transfers/movements ----------


@router.get("/movements", response_model=PrintedMovementPage)
async def list_movements_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("printed_stock.read"))],
    printed_transfer_id: Annotated[uuid.UUID | None, Query()] = None,
    print_design_id: Annotated[uuid.UUID | None, Query()] = None,
    side: Annotated[PrintSide | None, Query()] = None,
    kind: Annotated[PrintedMovementKind | None, Query()] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PrintedMovementPage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_movements(
        db,
        company_id=user.company_id,
        filters=PrintedMovementFilters(
            printed_transfer_id=printed_transfer_id,
            print_design_id=print_design_id,
            side=side,
            kind=kind,
            date_from=date_from,
            date_to=date_to,
        ),
        page=params,
    )
    items = [PrintedMovementRead(**row) for row in rows]
    return PrintedMovementPage.build(items, total, params)


# ---------- POST /printed-transfers/movements ----------


@router.post("/movements", response_model=PrintedMovementRead, status_code=status.HTTP_201_CREATED)
async def create_movement_endpoint(
    payload: PrintedMovementCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("printed_stock.write"))],
) -> PrintedMovementRead:
    movement = await create_movement(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    # Resolve the transfer's side for the response shape (movement has no side).
    rows, _ = await list_movements(
        db,
        company_id=user.company_id,
        filters=PrintedMovementFilters(printed_transfer_id=movement.printed_transfer_id),
        page=PageParams(page=1, page_size=1),
    )
    return PrintedMovementRead(**rows[0])


# ---------- POST /printed-transfers ----------


@router.post("", response_model=PrintedTransferLevelRead, status_code=status.HTTP_201_CREATED)
async def create_printed_transfer_endpoint(
    payload: PrintedTransferCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("printed_stock.write"))],
) -> PrintedTransferLevelRead:
    transfer = await create_printed_transfer(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    rows, _ = await list_levels(
        db,
        company_id=user.company_id,
        filters=PrintedTransferLevelFilters(print_design_id=transfer.print_design_id, side=transfer.side),
        page=PageParams(page=1, page_size=100),
    )
    row = next(r for r in rows if r["printed_transfer_id"] == transfer.id)
    return PrintedTransferLevelRead(**row)
