import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import FabricMovementKind, FabricRoll, FabricRollKind, FabricType, User
from schemas._common import PageParams
from schemas.fabric import (
    FabricMovementCreate,
    FabricMovementFilters,
    FabricMovementPage,
    FabricMovementRead,
    FabricRollCreate,
    FabricRollFilters,
    FabricRollPage,
    FabricRollRead,
    FabricRollUpdate,
)
from services import fabric as fabric_service
from services.fabric import (
    _to_read_kwargs,
    create_fabric_roll,
    delete_fabric_roll,
    get_fabric_roll,
    list_fabric_rolls,
    update_fabric_roll,
)

router = APIRouter(
    prefix="/fabric",
    tags=["Fabric"],
    dependencies=[Depends(RequirePermission("fabric.read"))],
)


def _to_read(roll: FabricRoll) -> FabricRollRead:
    return FabricRollRead(**_to_read_kwargs(roll))


@router.get("", response_model=FabricRollPage)
async def list_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("fabric.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    kind: Annotated[FabricRollKind | None, Query()] = None,
    fabric_type: Annotated[FabricType | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> FabricRollPage:
    params = PageParams(page=page, page_size=page_size)
    items, total = await list_fabric_rolls(
        db,
        company_id=user.company_id,
        filters=FabricRollFilters(q=q, kind=kind, fabric_type=fabric_type),
        page=params,
    )
    return FabricRollPage.build([_to_read(item) for item in items], total, params)


# ---------- GET /fabric/movements (declared before /{roll_id}) ----------


@router.get("/movements", response_model=FabricMovementPage)
async def list_movements_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("fabric.read"))],
    fabric_roll_id: Annotated[uuid.UUID | None, Query()] = None,
    kind: Annotated[FabricMovementKind | None, Query()] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> FabricMovementPage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await fabric_service.list_movements(
        db,
        company_id=user.company_id,
        filters=FabricMovementFilters(fabric_roll_id=fabric_roll_id, kind=kind, date_from=date_from, date_to=date_to),
        page=params,
    )
    items = [FabricMovementRead(**row) for row in rows]
    return FabricMovementPage.build(items, total, params)


@router.post("/movements", response_model=FabricMovementRead, status_code=status.HTTP_201_CREATED)
async def create_movement_endpoint(
    payload: FabricMovementCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("fabric.write"))],
) -> FabricMovementRead:
    movement = await fabric_service.create_movement(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return FabricMovementRead(
        id=movement.id,
        fabric_roll_id=movement.fabric_roll_id,
        kind=movement.kind,
        quantity=movement.quantity,
        cutting_order_id=movement.cutting_order_id,
        notes=movement.notes,
        created_at=movement.created_at,
    )


@router.get("/{roll_id}", response_model=FabricRollRead)
async def get_endpoint(
    roll_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("fabric.read"))],
) -> FabricRollRead:
    roll = await get_fabric_roll(db, company_id=user.company_id, roll_id=roll_id)
    return _to_read(roll)


@router.post("", response_model=FabricRollRead, status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    payload: FabricRollCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("fabric.write"))],
) -> FabricRollRead:
    roll = await create_fabric_roll(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return _to_read(roll)


@router.patch("/{roll_id}", response_model=FabricRollRead)
async def update_endpoint(
    roll_id: uuid.UUID,
    payload: FabricRollUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("fabric.write"))],
) -> FabricRollRead:
    roll = await update_fabric_roll(
        db,
        company_id=user.company_id,
        user_id=user.id,
        roll_id=roll_id,
        payload=payload,
    )
    return _to_read(roll)


@router.delete("/{roll_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_endpoint(
    roll_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("fabric.write"))],
) -> None:
    await delete_fabric_roll(
        db,
        company_id=user.company_id,
        user_id=user.id,
        roll_id=roll_id,
    )
