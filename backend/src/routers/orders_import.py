"""HTTP router for the Upseller order import.

``POST /v1/orders/import/upseller`` — multipart upload. Parses the CSV
exported from Upseller, strict-matches each line against the tenant
catalog, and creates an order (+ a linked import record) per match in a
single call. Unmatched rows come back in the summary's ``errors`` list;
``dry_run`` previews without writing.

Requires ``orders.write`` so an operator without that permission gets a
403 and never sees the import surface.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from dependencies import DbSession, RequirePermission
from models import User
from schemas.imported_orders import UpsellerImportSummary
from schemas.sku_mapping import SkuMappingCreate, SkuMappingPage, SkuMappingRead
from services import imported_orders as upseller_import_service
from services import sku_mapping as sku_mapping_service

router = APIRouter(
    prefix="/orders/import",
    tags=["OrdersImport"],
    dependencies=[Depends(RequirePermission("orders.write"))],
)


_MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB, mirrors the service constants


@router.post("/upseller", response_model=UpsellerImportSummary)
async def import_upseller_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
    file: Annotated[UploadFile, File(...)],
    dry_run: Annotated[bool, Form()] = False,
) -> UpsellerImportSummary:
    """Import the Upseller order CSV in one shot.

    Parses the export, strict-matches each line against the tenant catalog,
    and creates an order (+ linked import record) per match. Unmatched rows
    come back in ``errors``. ``dry_run`` previews without writing.
    """

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
    return await upseller_import_service.import_upseller_orders(
        db,
        company_id=user.company_id,
        user_id=user.id,
        file_bytes=data,
        dry_run=dry_run,
    )


@router.post("/sku-mappings", response_model=SkuMappingRead, status_code=status.HTTP_201_CREATED)
async def upsert_sku_mapping_endpoint(
    payload: SkuMappingCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> SkuMappingRead:
    """Pin a marketplace SKU to an ad + variation (the persistent De/Para).

    Once stored, every later import resolves this SKU deterministically. Re-pin
    the same SKU to overwrite a previous resolution.
    """

    return await sku_mapping_service.upsert_mapping(
        db,
        company_id=user.company_id,
        user_id=user.id,
        marketplace=payload.marketplace,
        sku=payload.sku,
        ad_id=payload.ad_id,
        variation_id=payload.variation_id,
    )


@router.get("/sku-mappings", response_model=SkuMappingPage)
async def list_sku_mappings_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> SkuMappingPage:
    """List the stored SKU → ad/variation mappings for this tenant."""

    return await sku_mapping_service.list_mappings(
        db,
        company_id=user.company_id,
        page=page,
        page_size=page_size,
    )


@router.delete("/sku-mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sku_mapping_endpoint(
    mapping_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> None:
    """Forget a SKU mapping — the SKU falls back to fuzzy matching."""

    await sku_mapping_service.delete_mapping(
        db,
        company_id=user.company_id,
        user_id=user.id,
        mapping_id=mapping_id,
    )
