"""HTTP surface for the Consumables / supply inventory (insumos) feature.

Layout
------
- GET    /supplies              — supply catalog (paginated, q-search).
- GET    /supplies/levels       — supply x on-hand aggregate (paginated).
- GET    /supplies/movements    — append-only ledger (paginated).
- POST   /supplies/movements    — append a movement (entry / exit / adjustment).
- GET    /supplies/{supply_id}  — single catalog entry.
- POST   /supplies              — create a catalog entry.
- PATCH  /supplies/{supply_id}  — update a catalog entry.
- DELETE /supplies/{supply_id}  — delete (blocked when movements exist).

The router enforces ``supplies.read`` at the include level; ``supplies.write``
is required inline on every mutation. The static ``/levels`` and ``/movements``
routes are declared BEFORE ``/{supply_id}`` so they aren't swallowed by the
UUID path matcher.
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import Supply, SupplyMovementKind, User
from schemas._common import PageParams
from schemas.supply import (
    SupplyCreate,
    SupplyFilters,
    SupplyLevelFilters,
    SupplyLevelPage,
    SupplyLevelRead,
    SupplyMovementCreate,
    SupplyMovementFilters,
    SupplyMovementPage,
    SupplyMovementRead,
    SupplyPage,
    SupplyRead,
    SupplyUpdate,
)
from services.supply import (
    create_movement,
    create_supply,
    delete_supply,
    get_supply,
    list_movements,
    list_supplies,
    list_supply_levels,
    update_supply,
)

router = APIRouter(
    prefix="/supplies",
    tags=["Supplies"],
    dependencies=[Depends(RequirePermission("supplies.read"))],
)


def _to_read(supply: Supply) -> SupplyRead:
    return SupplyRead(
        id=supply.id,
        name=supply.name,
        unit=supply.unit,
        unit_cost=supply.unit_cost,
        min_stock=supply.min_stock,
        notes=supply.notes,
        created_at=supply.created_at,
        updated_at=supply.updated_at,
    )


# ---------- GET /supplies ----------


@router.get("", response_model=SupplyPage)
async def list_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("supplies.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> SupplyPage:
    params = PageParams(page=page, page_size=page_size)
    items, total = await list_supplies(
        db,
        company_id=user.company_id,
        filters=SupplyFilters(q=q),
        page=params,
    )
    return SupplyPage.build([_to_read(item) for item in items], total, params)


# ---------- GET /supplies/levels ----------


@router.get("/levels", response_model=SupplyLevelPage)
async def list_levels_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("supplies.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    low_stock_only: Annotated[bool, Query()] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> SupplyLevelPage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_supply_levels(
        db,
        company_id=user.company_id,
        filters=SupplyLevelFilters(q=q, low_stock_only=low_stock_only),
        page=params,
    )
    items = [SupplyLevelRead(**row) for row in rows]
    return SupplyLevelPage.build(items, total, params)


# ---------- GET /supplies/movements ----------


@router.get("/movements", response_model=SupplyMovementPage)
async def list_movements_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("supplies.read"))],
    supply_id: Annotated[uuid.UUID | None, Query()] = None,
    kind: Annotated[SupplyMovementKind | None, Query()] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> SupplyMovementPage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_movements(
        db,
        company_id=user.company_id,
        filters=SupplyMovementFilters(supply_id=supply_id, kind=kind, date_from=date_from, date_to=date_to),
        page=params,
    )
    items = [SupplyMovementRead(**row) for row in rows]
    return SupplyMovementPage.build(items, total, params)


# ---------- POST /supplies/movements ----------


@router.post("/movements", response_model=SupplyMovementRead, status_code=status.HTTP_201_CREATED)
async def create_movement_endpoint(
    payload: SupplyMovementCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("supplies.write"))],
) -> SupplyMovementRead:
    movement = await create_movement(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return SupplyMovementRead(
        id=movement.id,
        supply_id=movement.supply_id,
        kind=movement.kind,
        quantity=movement.quantity,
        notes=movement.notes,
        created_at=movement.created_at,
    )


# ---------- GET /supplies/{supply_id} ----------


@router.get("/{supply_id}", response_model=SupplyRead)
async def get_endpoint(
    supply_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("supplies.read"))],
) -> SupplyRead:
    supply = await get_supply(db, company_id=user.company_id, supply_id=supply_id)
    return _to_read(supply)


# ---------- POST /supplies ----------


@router.post("", response_model=SupplyRead, status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    payload: SupplyCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("supplies.write"))],
) -> SupplyRead:
    supply = await create_supply(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return _to_read(supply)


# ---------- PATCH /supplies/{supply_id} ----------


@router.patch("/{supply_id}", response_model=SupplyRead)
async def update_endpoint(
    supply_id: uuid.UUID,
    payload: SupplyUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("supplies.write"))],
) -> SupplyRead:
    supply = await update_supply(
        db,
        company_id=user.company_id,
        user_id=user.id,
        supply_id=supply_id,
        payload=payload,
    )
    return _to_read(supply)


# ---------- DELETE /supplies/{supply_id} ----------


@router.delete("/{supply_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_endpoint(
    supply_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("supplies.write"))],
) -> None:
    await delete_supply(
        db,
        company_id=user.company_id,
        user_id=user.id,
        supply_id=supply_id,
    )
