import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import FabricRoll, FabricRollKind, FabricType, User
from schemas._common import PageParams
from schemas.fabric import (
    FabricRollCreate,
    FabricRollFilters,
    FabricRollPage,
    FabricRollRead,
    FabricRollUpdate,
)
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
