"""HTTP surface for the Print Stock (estoque de estampas / impresso) feature.

Layout
------
- GET  /print-stock/levels    — (design x colour) on-hand aggregate (paginated).
- GET  /print-stock/movements — append-only ledger (paginated, filterable).
- POST /print-stock/entries   — record a manual printed-stamp entry.
- POST /print-stock/exits     — record a manual printed-stamp exit.

The router enforces `print_stock.read` at the include level; `print_stock.write`
is required inline on the two POST endpoints.
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import PrintStockDirection, User
from schemas._common import PageParams
from schemas.print_stock import (
    PrintStockEntryCreate,
    PrintStockExitCreate,
    PrintStockLevelFilters,
    PrintStockLevelPage,
    PrintStockLevelRead,
    PrintStockMovementFilters,
    PrintStockMovementPage,
    PrintStockMovementRead,
)
from services.print_stock import (
    create_entry,
    create_exit,
    list_levels,
    list_movements,
)

router = APIRouter(
    prefix="/print-stock",
    tags=["Print Stock"],
    dependencies=[Depends(RequirePermission("print_stock.read"))],
)


# ---------- GET /print-stock/levels ----------


@router.get("/levels", response_model=PrintStockLevelPage)
async def list_levels_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("print_stock.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    print_design_id: Annotated[uuid.UUID | None, Query()] = None,
    product_color: Annotated[str | None, Query(max_length=80)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PrintStockLevelPage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_levels(
        db,
        company_id=user.company_id,
        filters=PrintStockLevelFilters(q=q, print_design_id=print_design_id, product_color=product_color),
        page=params,
    )
    items = [PrintStockLevelRead(**row) for row in rows]
    return PrintStockLevelPage.build(items, total, params)


# ---------- GET /print-stock/movements ----------


@router.get("/movements", response_model=PrintStockMovementPage)
async def list_movements_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("print_stock.read"))],
    print_design_id: Annotated[uuid.UUID | None, Query()] = None,
    product_color: Annotated[str | None, Query(max_length=80)] = None,
    direction: Annotated[PrintStockDirection | None, Query()] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PrintStockMovementPage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_movements(
        db,
        company_id=user.company_id,
        filters=PrintStockMovementFilters(
            print_design_id=print_design_id,
            product_color=product_color,
            direction=direction,
            date_from=date_from,
            date_to=date_to,
        ),
        page=params,
    )
    items = [PrintStockMovementRead(**row) for row in rows]
    return PrintStockMovementPage.build(items, total, params)


# ---------- POST /print-stock/entries ----------


@router.post("/entries", response_model=PrintStockMovementRead, status_code=status.HTTP_201_CREATED)
async def create_entry_endpoint(
    payload: PrintStockEntryCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("print_stock.write"))],
) -> PrintStockMovementRead:
    movement = await create_entry(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return PrintStockMovementRead(
        id=movement.id,
        print_design_id=movement.print_design_id,
        product_color=movement.product_color,
        direction=movement.direction,
        quantity=movement.quantity,
        notes=movement.notes,
        created_at=movement.created_at,
    )


# ---------- POST /print-stock/exits ----------


@router.post("/exits", response_model=PrintStockMovementRead, status_code=status.HTTP_201_CREATED)
async def create_exit_endpoint(
    payload: PrintStockExitCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("print_stock.write"))],
) -> PrintStockMovementRead:
    movement = await create_exit(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return PrintStockMovementRead(
        id=movement.id,
        print_design_id=movement.print_design_id,
        product_color=movement.product_color,
        direction=movement.direction,
        quantity=movement.quantity,
        notes=movement.notes,
        created_at=movement.created_at,
    )
