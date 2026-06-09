"""HTTP surface for the Stock feature.

Layout
------
- GET  /stock/levels    — variation x on-hand aggregate (paginated).
- GET  /stock/movements — interleaved entries + exits ledger (paginated).
- POST /stock/entries   — append-only stock entry (manual adjustment).
- POST /stock/exits     — append-only stock exit (manual adjustment).

The router enforces `stock.read` at the include level; `stock.write` is
required inline on the two POST endpoints.
"""

import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import select

from dependencies import DbSession, RequirePermission
from models import ProductVariation, StockEntry, StockExit, User
from schemas._common import PageParams
from schemas.stock import (
    EntryPage,
    ExitPage,
    MovementsFilters,
    MovementsPage,
    StockEntryCreate,
    StockEntryRead,
    StockExitCreate,
    StockExitRead,
    StockFilters,
    StockOrderMini,
    StockPage,
    StockShipmentMini,
    VariationStockRead,
)
from schemas.stock_settings import StockSettingsRead, StockSettingsUpdate
from services.stock import (
    create_entry,
    create_exit,
    list_movements,
    list_stock_levels,
)
from services.stock_settings import get_threshold, set_threshold

router = APIRouter(
    prefix="/stock",
    tags=["Stock"],
    dependencies=[Depends(RequirePermission("stock.read"))],
)


async def _resolve_sku(db, *, variation_id: uuid.UUID, company_id: uuid.UUID) -> str:
    """Look the SKU back up so the router can build a `StockEntryRead`/`StockExitRead`."""

    stmt = select(ProductVariation.sku).where(
        ProductVariation.id == variation_id,
        ProductVariation.company_id == company_id,
    )
    result = await db.exec(stmt)
    sku = result.first()
    return sku if isinstance(sku, str) else str(sku)


def _entry_to_read(entry: StockEntry, *, sku: str) -> StockEntryRead:
    return StockEntryRead(
        id=entry.id,
        variation_id=entry.variation_id,
        sku=sku,
        source=entry.source,
        quantity=entry.quantity,
        notes=entry.notes,
        created_at=entry.created_at,
        shipment=StockShipmentMini(id=entry.shipment_id) if entry.shipment_id else None,
    )


def _exit_to_read(exit_row: StockExit, *, sku: str) -> StockExitRead:
    return StockExitRead(
        id=exit_row.id,
        variation_id=exit_row.variation_id,
        sku=sku,
        reason=exit_row.reason,
        quantity=exit_row.quantity,
        notes=exit_row.notes,
        created_at=exit_row.created_at,
        order=StockOrderMini(id=exit_row.order_id) if exit_row.order_id else None,
    )


# ---------- GET /stock/settings ----------


@router.get("/settings", response_model=StockSettingsRead)
async def get_stock_settings_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("stock.read"))],
) -> StockSettingsRead:
    threshold = await get_threshold(db, company_id=user.company_id)
    return StockSettingsRead(low_stock_threshold=threshold)


# ---------- PUT /stock/settings ----------


@router.put("/settings", response_model=StockSettingsRead)
async def update_stock_settings_endpoint(
    payload: StockSettingsUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("stock.write"))],
) -> StockSettingsRead:
    threshold = await set_threshold(
        db,
        company_id=user.company_id,
        user_id=user.id,
        threshold=payload.low_stock_threshold,
    )
    return StockSettingsRead(low_stock_threshold=threshold)


# ---------- GET /stock/levels ----------


@router.get("/levels", response_model=StockPage)
async def list_levels_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("stock.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    product_id: Annotated[uuid.UUID | None, Query()] = None,
    low_stock_only: Annotated[bool, Query()] = False,
    threshold: Annotated[int, Query(ge=0)] = 5,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> StockPage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_stock_levels(
        db,
        company_id=user.company_id,
        filters=StockFilters(
            q=q,
            product_id=product_id,
            low_stock_only=low_stock_only,
            threshold=threshold,
        ),
        page=params,
    )
    items = [VariationStockRead(**row) for row in rows]
    return StockPage.build(items, total, params)


# ---------- GET /stock/movements ----------


@router.get("/movements", response_model=MovementsPage)
async def list_movements_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("stock.read"))],
    variation_id: Annotated[uuid.UUID | None, Query()] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    type: Annotated[Literal["entry", "exit"] | None, Query()] = None,
    reason_or_source: Annotated[str | None, Query(max_length=40)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> MovementsPage:
    params = PageParams(page=page, page_size=page_size)
    items, total = await list_movements(
        db,
        company_id=user.company_id,
        filters=MovementsFilters(
            variation_id=variation_id,
            date_from=date_from,
            date_to=date_to,
            type=type,
            reason_or_source=reason_or_source,
        ),
        page=params,
    )
    return MovementsPage.build(items, total, params)


# ---------- POST /stock/entries ----------


@router.post("/entries", response_model=StockEntryRead, status_code=status.HTTP_201_CREATED)
async def create_entry_endpoint(
    payload: StockEntryCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("stock.write"))],
) -> StockEntryRead:
    entry = await create_entry(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    sku = await _resolve_sku(db, variation_id=entry.variation_id, company_id=user.company_id)
    return _entry_to_read(entry, sku=sku)


# ---------- POST /stock/exits ----------


@router.post("/exits", response_model=StockExitRead, status_code=status.HTTP_201_CREATED)
async def create_exit_endpoint(
    payload: StockExitCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("stock.write"))],
) -> StockExitRead:
    exit_row = await create_exit(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    sku = await _resolve_sku(db, variation_id=exit_row.variation_id, company_id=user.company_id)
    return _exit_to_read(exit_row, sku=sku)


# Page aliases re-exported so frontend codegen sees them.
_ = (EntryPage, ExitPage)
