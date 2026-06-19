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

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from dependencies import DbSession, RequirePermission
from models import User
from schemas.imported_orders import UpsellerImportSummary
from services import imported_orders as upseller_import_service

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
