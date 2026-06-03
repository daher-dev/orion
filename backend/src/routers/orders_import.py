"""HTTP router for FEATURE-014 — Sales Orders Import.

Two endpoints under ``/v1/orders/import``:

- ``POST /parse`` — multipart upload. Accepts a PDF or a CSV and returns
  a :class:`ParseResponse` with one :class:`ParsedOrderRow` per detected
  order. CSVs are deterministic; PDFs go through the Anthropic API.
- ``POST /commit`` — JSON body. Resolves each (potentially user-edited)
  row against the tenant's catalog and persists the orders; surfaces
  per-row errors so the UI can keep the failed rows visible.

Both endpoints require ``orders.write`` so an operator without that
permission gets a 403 and never sees the import surface.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from dependencies import DbSession, RequirePermission
from models import User
from schemas.imported_orders import UpsellerImportSummary
from schemas.orders_import import (
    CommitOrdersBody,
    CommitOrdersResponse,
    ImportFormat,
    ParseResponse,
)
from services import imported_orders as upseller_import_service
from services import orders_import as import_service

router = APIRouter(
    prefix="/orders/import",
    tags=["OrdersImport"],
    dependencies=[Depends(RequirePermission("orders.write"))],
)


_MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB, mirrors the service constants


@router.post("/parse", response_model=ParseResponse)
async def parse_import_endpoint(
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
    file: Annotated[UploadFile, File(...)],
    format: Annotated[ImportFormat, Form()] = ImportFormat.AUTO,
) -> ParseResponse:
    """Parse a CSV or PDF upload into rows the user can review + edit."""

    # ``user`` is kept in the signature so the dependency runs (and so
    # tests can verify the permission gate). It is not used in the body
    # — the parse step is stateless w.r.t. the tenant.
    _ = user
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
    return await import_service.parse_upload(
        file_bytes=data,
        filename=file.filename,
        format_hint=format,
    )


@router.post("/commit", response_model=CommitOrdersResponse)
async def commit_import_endpoint(
    payload: CommitOrdersBody,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("orders.write"))],
) -> CommitOrdersResponse:
    """Persist the reviewed rows as orders. Per-row failures are surfaced."""

    return await import_service.commit_orders(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )


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
