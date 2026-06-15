"""HTTP surface for the Paper Rolls (bobinas de papel/filme) WIP inventory tier.

Layout
------
- GET    /paper-rolls               — roll catalog (paginated, q-search). Doubles
                                       as the "levels" view (on-hand = current_meters).
- GET    /paper-rolls/movements     — append-only history ledger (paginated).
- POST   /paper-rolls/movements     — append a manual movement (entry/exit/adjustment).
- GET    /paper-rolls/{roll_id}     — single roll.
- POST   /paper-rolls               — receive a roll.
- PATCH  /paper-rolls/{roll_id}     — update a roll.
- POST   /paper-rolls/{roll_id}/consume — debit meters (clamped at 0).
- DELETE /paper-rolls/{roll_id}     — delete (blocked when movements exist).

The router enforces ``paper.read`` at the include level; ``paper.write`` is
required inline on every mutation. The static ``/movements`` route is declared
BEFORE ``/{roll_id}`` so it isn't swallowed by the UUID path matcher. There is
no separate ``/levels`` — the roll list IS the levels view.
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import PaperMovementKind, PaperType, User
from schemas._common import PageParams
from schemas.paper_roll import (
    PaperMovementCreate,
    PaperMovementFilters,
    PaperMovementPage,
    PaperMovementRead,
    PaperRollConsume,
    PaperRollCreate,
    PaperRollFilters,
    PaperRollPage,
    PaperRollRead,
    PaperRollUpdate,
)
from services import paper_roll as paper_roll_service

router = APIRouter(
    prefix="/paper-rolls",
    tags=["Paper Rolls"],
    dependencies=[Depends(RequirePermission("paper.read"))],
)


# ---------- GET /paper-rolls ----------


@router.get("", response_model=PaperRollPage)
async def list_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("paper.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    paper_type: Annotated[PaperType | None, Query()] = None,
    low_stock_only: Annotated[bool, Query()] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PaperRollPage:
    params = PageParams(page=page, page_size=page_size)
    rolls, total = await paper_roll_service.list_paper_rolls(
        db,
        company_id=user.company_id,
        filters=PaperRollFilters(q=q, paper_type=paper_type, low_stock_only=low_stock_only),
        page=params,
    )
    reads = await paper_roll_service.to_read_many(db, company_id=user.company_id, rolls=rolls)
    items = [PaperRollRead(**read) for read in reads]
    return PaperRollPage.build(items, total, params)


# ---------- GET /paper-rolls/movements ----------


@router.get("/movements", response_model=PaperMovementPage)
async def list_movements_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("paper.read"))],
    paper_roll_id: Annotated[uuid.UUID | None, Query()] = None,
    kind: Annotated[PaperMovementKind | None, Query()] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PaperMovementPage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await paper_roll_service.list_movements(
        db,
        company_id=user.company_id,
        filters=PaperMovementFilters(paper_roll_id=paper_roll_id, kind=kind, date_from=date_from, date_to=date_to),
        page=params,
    )
    items = [PaperMovementRead(**row) for row in rows]
    return PaperMovementPage.build(items, total, params)


# ---------- POST /paper-rolls/movements ----------


@router.post("/movements", response_model=PaperMovementRead, status_code=status.HTTP_201_CREATED)
async def create_movement_endpoint(
    payload: PaperMovementCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("paper.write"))],
) -> PaperMovementRead:
    movement = await paper_roll_service.create_movement(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return PaperMovementRead(
        id=movement.id,
        paper_roll_id=movement.paper_roll_id,
        kind=movement.kind,
        quantity=movement.quantity,
        notes=movement.notes,
        created_at=movement.created_at,
    )


# ---------- GET /paper-rolls/{roll_id} ----------


@router.get("/{roll_id}", response_model=PaperRollRead)
async def get_endpoint(
    roll_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("paper.read"))],
) -> PaperRollRead:
    roll = await paper_roll_service.get_paper_roll(db, company_id=user.company_id, roll_id=roll_id)
    return PaperRollRead(**await paper_roll_service.to_read(db, company_id=user.company_id, roll=roll))


# ---------- POST /paper-rolls ----------


@router.post("", response_model=PaperRollRead, status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    payload: PaperRollCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("paper.write"))],
) -> PaperRollRead:
    roll = await paper_roll_service.create_paper_roll(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return PaperRollRead(**await paper_roll_service.to_read(db, company_id=user.company_id, roll=roll))


# ---------- PATCH /paper-rolls/{roll_id} ----------


@router.patch("/{roll_id}", response_model=PaperRollRead)
async def update_endpoint(
    roll_id: uuid.UUID,
    payload: PaperRollUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("paper.write"))],
) -> PaperRollRead:
    roll = await paper_roll_service.update_paper_roll(
        db,
        company_id=user.company_id,
        user_id=user.id,
        roll_id=roll_id,
        payload=payload,
    )
    return PaperRollRead(**await paper_roll_service.to_read(db, company_id=user.company_id, roll=roll))


# ---------- POST /paper-rolls/{roll_id}/consume ----------


@router.post("/{roll_id}/consume", response_model=PaperRollRead)
async def consume_endpoint(
    roll_id: uuid.UUID,
    payload: PaperRollConsume,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("paper.write"))],
) -> PaperRollRead:
    roll = await paper_roll_service.consume(
        db,
        company_id=user.company_id,
        user_id=user.id,
        roll_id=roll_id,
        payload=payload,
    )
    return PaperRollRead(**await paper_roll_service.to_read(db, company_id=user.company_id, roll=roll))


# ---------- DELETE /paper-rolls/{roll_id} ----------


@router.delete("/{roll_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_endpoint(
    roll_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("paper.write"))],
) -> None:
    await paper_roll_service.delete_paper_roll(
        db,
        company_id=user.company_id,
        user_id=user.id,
        roll_id=roll_id,
    )
