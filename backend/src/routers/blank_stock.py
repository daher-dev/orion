"""HTTP surface for the Blank Pieces (peças lisas) WIP inventory tier.

Layout
------
- GET  /blank-stock/levels    — blank-piece on-hand aggregate (paginated, every row).
- GET  /blank-stock/movements — append-only ledger (paginated, filterable).
- POST /blank-stock/movements — append a movement (entry / exit / adjustment).
- POST /blank-stock           — create an empty blank-piece catalog row (new key).

The router enforces ``blank_stock.read`` at the include level; ``blank_stock.write``
is required inline on the mutations. The static ``/levels`` / ``/movements``
routes are declared with explicit paths (no ``/{id}`` matcher collides here).
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import BlankMovementKind, User
from schemas._common import PageParams
from schemas.blank_stock import (
    BlankMovementCreate,
    BlankMovementFilters,
    BlankMovementPage,
    BlankMovementRead,
    BlankPieceCreate,
    BlankPieceLevelFilters,
    BlankPieceLevelPage,
    BlankPieceLevelRead,
    BlankPieceLevelSummary,
)
from services.blank_stock import (
    create_blank_piece,
    create_movement,
    levels_summary,
    list_levels,
    list_movements,
)

router = APIRouter(
    prefix="/blank-stock",
    tags=["Blank Stock"],
    dependencies=[Depends(RequirePermission("blank_stock.read"))],
)


# ---------- GET /blank-stock/levels ----------


@router.get("/levels", response_model=BlankPieceLevelPage)
async def list_levels_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("blank_stock.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    spec_id: Annotated[uuid.UUID | None, Query()] = None,
    size: Annotated[str | None, Query()] = None,
    low_stock_only: Annotated[bool, Query()] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> BlankPieceLevelPage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_levels(
        db,
        company_id=user.company_id,
        filters=BlankPieceLevelFilters(q=q, spec_id=spec_id, size=size, low_stock_only=low_stock_only),
        page=params,
    )
    items = [BlankPieceLevelRead(**row) for row in rows]
    return BlankPieceLevelPage.build(items, total, params)


# ---------- GET /blank-stock/levels/summary ----------


@router.get("/levels/summary", response_model=BlankPieceLevelSummary)
async def levels_summary_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("blank_stock.read"))],
) -> BlankPieceLevelSummary:
    """Tenant-wide totals for the page KPIs (every SKU, not the current page)."""
    return BlankPieceLevelSummary(**await levels_summary(db, company_id=user.company_id))


# ---------- GET /blank-stock/movements ----------


@router.get("/movements", response_model=BlankMovementPage)
async def list_movements_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("blank_stock.read"))],
    blank_piece_id: Annotated[uuid.UUID | None, Query()] = None,
    kind: Annotated[BlankMovementKind | None, Query()] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> BlankMovementPage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_movements(
        db,
        company_id=user.company_id,
        filters=BlankMovementFilters(blank_piece_id=blank_piece_id, kind=kind, date_from=date_from, date_to=date_to),
        page=params,
    )
    items = [BlankMovementRead(**row) for row in rows]
    return BlankMovementPage.build(items, total, params)


# ---------- POST /blank-stock/movements ----------


@router.post("/movements", response_model=BlankMovementRead, status_code=status.HTTP_201_CREATED)
async def create_movement_endpoint(
    payload: BlankMovementCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("blank_stock.write"))],
) -> BlankMovementRead:
    movement = await create_movement(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return BlankMovementRead(
        id=movement.id,
        blank_piece_id=movement.blank_piece_id,
        kind=movement.kind,
        quantity=movement.quantity,
        notes=movement.notes,
        created_at=movement.created_at,
    )


# ---------- POST /blank-stock ----------


@router.post("", response_model=BlankPieceLevelRead, status_code=status.HTTP_201_CREATED)
async def create_blank_piece_endpoint(
    payload: BlankPieceCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("blank_stock.write"))],
) -> BlankPieceLevelRead:
    piece = await create_blank_piece(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    # Re-read the single level row so the response carries spec + computed fields.
    rows, _ = await list_levels(
        db,
        company_id=user.company_id,
        filters=BlankPieceLevelFilters(spec_id=piece.spec_id, size=piece.size),
        page=PageParams(page=1, page_size=100),
    )
    row = next(r for r in rows if r["blank_piece_id"] == piece.id)
    return BlankPieceLevelRead(**row)
