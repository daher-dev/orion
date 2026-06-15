"""HTTP router for the Assembly (Montagem) feature — T5.

Thin: every endpoint defers to :mod:`services.assembly`. Permissions are
enforced via a router-level ``assembly.read`` dependency and an inline
``assembly.write`` dependency on the assemble mutation. ``/buildable`` is a live
on-hand discovery assist; ``POST /assembly`` is the T5 posting action (blank +
printed debit, finished credit, SKU resolution) in one transaction.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import User
from schemas._common import PageParams
from schemas.assembly import (
    AssembleBody,
    AssemblyBuildablePage,
    AssemblyRunRead,
    BuildableFilters,
)
from services import assembly as assembly_service

router = APIRouter(
    prefix="/assembly",
    tags=["Assembly"],
    dependencies=[Depends(RequirePermission("assembly.read"))],
)


# Declared before any /{id} matcher (none exist today, but keep the ordering
# convention consistent with cutting's /available).
@router.get("/buildable", response_model=AssemblyBuildablePage)
async def list_buildable_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("assembly.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    print_design_id: Annotated[uuid.UUID | None, Query()] = None,
    spec_id: Annotated[uuid.UUID | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> AssemblyBuildablePage:
    params = PageParams(page=page, page_size=page_size)
    rows, total = await assembly_service.list_buildable(
        db,
        company_id=user.company_id,
        filters=BuildableFilters(q=q, print_design_id=print_design_id, spec_id=spec_id),
        page=params,
    )
    return AssemblyBuildablePage.build(rows, total, params)


@router.post("", response_model=AssemblyRunRead, status_code=status.HTTP_201_CREATED)
async def assemble_endpoint(
    payload: AssembleBody,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("assembly.write"))],
) -> AssemblyRunRead:
    return await assembly_service.assemble(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
