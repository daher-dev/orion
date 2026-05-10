"""Prints (estampas) HTTP router."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import User
from schemas._common import PageParams
from schemas.print_design import (
    PrintCreate,
    PrintFilters,
    PrintPage,
    PrintRead,
    PrintUpdate,
)
from services import print_design as print_service

router = APIRouter(
    prefix="/prints",
    tags=["Prints"],
    dependencies=[Depends(RequirePermission("prints.read"))],
)


def _to_read(print_design) -> PrintRead:
    return PrintRead.model_validate(print_design, from_attributes=True)


@router.get("", response_model=PrintPage)
async def list_prints_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("prints.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PrintPage:
    filters = PrintFilters(q=q)
    params = PageParams(page=page, page_size=page_size)
    rows, total = await print_service.list_prints(
        db,
        company_id=user.company_id,
        filters=filters,
        page=params,
    )
    return PrintPage.build([_to_read(r) for r in rows], total, params)


@router.get("/{print_id}", response_model=PrintRead)
async def get_print_endpoint(
    print_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("prints.read"))],
) -> PrintRead:
    print_design = await print_service.get_print(db, company_id=user.company_id, print_id=print_id)
    return _to_read(print_design)


@router.post("", response_model=PrintRead, status_code=status.HTTP_201_CREATED)
async def create_print_endpoint(
    payload: PrintCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("prints.write"))],
) -> PrintRead:
    print_design = await print_service.create_print(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return _to_read(print_design)


@router.patch("/{print_id}", response_model=PrintRead)
async def update_print_endpoint(
    print_id: uuid.UUID,
    payload: PrintUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("prints.write"))],
) -> PrintRead:
    print_design = await print_service.update_print(
        db,
        company_id=user.company_id,
        user_id=user.id,
        print_id=print_id,
        payload=payload,
    )
    return _to_read(print_design)


@router.delete("/{print_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_print_endpoint(
    print_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("prints.write"))],
) -> None:
    await print_service.delete_print(
        db,
        company_id=user.company_id,
        user_id=user.id,
        print_id=print_id,
    )
