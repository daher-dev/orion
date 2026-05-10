"""Specs (fichas técnicas) HTTP router."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import ProductSpec, SpecTrim, User
from models.enums import FabricType
from schemas._common import Page, PageParams
from schemas.spec import SpecCreate, SpecFilters, SpecRead, SpecUpdate, TrimItem
from services import spec as spec_service

router = APIRouter(prefix="/specs", tags=["Specs"])


def _to_read(spec: ProductSpec, trims: list[SpecTrim]) -> SpecRead:
    return SpecRead(
        id=spec.id,
        company_id=spec.company_id,
        code=spec.code,
        name=spec.name,
        fabric_type=spec.fabric_type,
        fabric_grammage_gsm=spec.fabric_grammage_gsm,
        fabric_weight_per_piece_g=spec.fabric_weight_per_piece_g,
        has_ribana=spec.has_ribana,
        ribana_weight_pct=spec.ribana_weight_pct,
        labor_cost=spec.labor_cost,
        sale_price=spec.sale_price,
        notes=spec.notes,
        trims=[
            TrimItem(
                trim_type=t.trim_type,
                unit_price=t.unit_price,
                quantity=t.quantity,
            )
            for t in trims
        ],
        created_at=spec.created_at,
        updated_at=spec.updated_at,
    )


@router.get("", response_model=Page[SpecRead])
async def list_specs_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("specs.read"))],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    q: Annotated[str | None, Query()] = None,
    fabric_type: Annotated[FabricType | None, Query()] = None,
) -> Page[SpecRead]:
    page_params = PageParams(page=page, page_size=page_size)
    filters = SpecFilters(q=q, fabric_type=fabric_type)
    rows, total = await spec_service.list_specs(
        db,
        company_id=user.company_id,
        filters=filters,
        page=page_params,
    )
    items = [_to_read(spec, trims) for spec, trims in rows]
    return Page[SpecRead].build(items=items, total=total, params=page_params)


@router.get("/{spec_id}", response_model=SpecRead)
async def get_spec_endpoint(
    spec_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("specs.read"))],
) -> SpecRead:
    spec, trims = await spec_service.get_spec(db, company_id=user.company_id, spec_id=spec_id)
    return _to_read(spec, trims)


@router.post("", response_model=SpecRead, status_code=status.HTTP_201_CREATED)
async def create_spec_endpoint(
    payload: SpecCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("specs.write"))],
) -> SpecRead:
    spec, trims = await spec_service.create_spec(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return _to_read(spec, trims)


@router.patch("/{spec_id}", response_model=SpecRead)
async def update_spec_endpoint(
    spec_id: uuid.UUID,
    payload: SpecUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("specs.write"))],
) -> SpecRead:
    spec, trims = await spec_service.update_spec(
        db,
        company_id=user.company_id,
        user_id=user.id,
        spec_id=spec_id,
        payload=payload,
    )
    return _to_read(spec, trims)


@router.delete("/{spec_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_spec_endpoint(
    spec_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("specs.write"))],
) -> None:
    await spec_service.delete_spec(
        db,
        company_id=user.company_id,
        user_id=user.id,
        spec_id=spec_id,
    )
