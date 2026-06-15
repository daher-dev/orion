"""Prints (estampas) HTTP router."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from dependencies import DbSession, RequirePermission
from models import User
from models.enums import PrintSide
from schemas._common import PageParams
from schemas.print_design import (
    PrintCreate,
    PrintFilters,
    PrintPage,
    PrintRead,
    PrintUpdate,
    PrintVariationCreate,
    PrintVariationRead,
    PrintVariationUpdate,
)
from services import artwork as artwork_service
from services import print_design as print_service
from services.print_design import PrintWithVariations

router = APIRouter(
    prefix="/prints",
    tags=["Prints"],
    dependencies=[Depends(RequirePermission("prints.read"))],
)

_MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB, mirrors routers/orders_import.py


def _variation_to_read(variation) -> PrintVariationRead:
    return PrintVariationRead.model_validate(variation, from_attributes=True)


def _to_read(result: PrintWithVariations) -> PrintRead:
    print_design, variations = result
    data = PrintRead.model_validate(print_design, from_attributes=True)
    data.variations = [_variation_to_read(v) for v in variations]
    return data


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


# ----------------------------------------------------------------- variations


@router.get("/{print_id}/variations", response_model=list[PrintVariationRead])
async def list_variations_endpoint(
    print_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("prints.read"))],
) -> list[PrintVariationRead]:
    variations = await print_service.list_variations(db, company_id=user.company_id, print_id=print_id)
    return [_variation_to_read(v) for v in variations]


@router.post(
    "/{print_id}/variations",
    response_model=PrintVariationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_variation_endpoint(
    print_id: uuid.UUID,
    payload: PrintVariationCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("prints.write"))],
) -> PrintVariationRead:
    variation = await print_service.create_variation(
        db,
        company_id=user.company_id,
        user_id=user.id,
        print_id=print_id,
        payload=payload,
    )
    return _variation_to_read(variation)


@router.patch("/{print_id}/variations/{variation_id}", response_model=PrintVariationRead)
async def update_variation_endpoint(
    print_id: uuid.UUID,
    variation_id: uuid.UUID,
    payload: PrintVariationUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("prints.write"))],
) -> PrintVariationRead:
    variation = await print_service.update_variation(
        db,
        company_id=user.company_id,
        user_id=user.id,
        print_id=print_id,
        variation_id=variation_id,
        payload=payload,
    )
    return _variation_to_read(variation)


@router.delete(
    "/{print_id}/variations/{variation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_variation_endpoint(
    print_id: uuid.UUID,
    variation_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("prints.write"))],
) -> None:
    await print_service.delete_variation(
        db,
        company_id=user.company_id,
        user_id=user.id,
        print_id=print_id,
        variation_id=variation_id,
    )


@router.post(
    "/{print_id}/variations/{variation_id}/artwork",
    response_model=PrintVariationRead,
)
async def upload_variation_artwork_endpoint(
    print_id: uuid.UUID,
    variation_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("prints.write"))],
    file: Annotated[UploadFile, File(...)],
    side: Annotated[PrintSide, Form(...)],
) -> PrintVariationRead:
    """Upload a per-side PNG for a variation and mark that side ``ok``."""

    # Ensure the variation exists/scoped before touching storage (avoids an
    # orphan object write for an unknown print/variation).
    await print_service.get_variation(
        db,
        company_id=user.company_id,
        print_id=print_id,
        variation_id=variation_id,
    )

    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Upload exceeds 5MB limit",
        )

    file_url = artwork_service.upload_artwork(
        company_id=user.company_id,
        print_id=print_id,
        variation_id=variation_id,
        side=side.value,
        data=data,
        content_type=file.content_type,
        filename=file.filename,
    )
    variation = await print_service.set_variation_artwork(
        db,
        company_id=user.company_id,
        user_id=user.id,
        print_id=print_id,
        variation_id=variation_id,
        side=side,
        file_url=file_url,
    )
    return _variation_to_read(variation)
