"""Service layer for Specs (fichas técnicas).

Tenant scoping is enforced through ``scoped()`` on every read; mutations always
write the active ``company_id`` explicitly. Trim list updates are atomic — when
``payload.trims`` is provided in an update, the entire prior list is replaced.

Services return a ``(ProductSpec, list[SpecTrim])`` tuple so the router builds
the response envelope without re-reading.
"""

from __future__ import annotations

import uuid

from sqlalchemy.exc import IntegrityError
from sqlmodel import delete, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Product, ProductSpec, SpecTrim
from schemas._common import PageParams
from schemas.spec import SpecCreate, SpecFilters, SpecUpdate
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError, ValidationError

SpecWithTrims = tuple[ProductSpec, list[SpecTrim]]


async def _trims_for(db: AsyncSession, spec_id: uuid.UUID) -> list[SpecTrim]:
    result = await db.exec(
        select(SpecTrim).where(SpecTrim.spec_id == spec_id).order_by(SpecTrim.created_at.asc())  # type: ignore[attr-defined]
    )
    return list(result.all())


async def list_specs(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: SpecFilters | None = None,
    page: PageParams | None = None,
) -> tuple[list[SpecWithTrims], int]:
    """Paginate specs for a company. Filters: free-text on code/name + fabric type."""

    filters = filters or SpecFilters()
    page = page or PageParams()

    base = scoped(select(ProductSpec), ProductSpec, company_id)
    if filters.q:
        needle = f"%{filters.q.lower()}%"
        base = base.where((func.lower(ProductSpec.code).like(needle)) | (func.lower(ProductSpec.name).like(needle)))
    if filters.fabric_type is not None:
        base = base.where(ProductSpec.fabric_type == filters.fabric_type)

    count_result = await db.exec(select(func.count()).select_from(base.subquery()))
    total = int(count_result.first() or 0)

    stmt = (
        base.order_by(ProductSpec.updated_at.desc())  # type: ignore[attr-defined]
        .limit(page.page_size)
        .offset(page.offset)
    )
    result = await db.exec(stmt)
    rows = list(result.all())

    if not rows:
        return [], total

    trims_result = await db.exec(
        select(SpecTrim)
        .where(SpecTrim.spec_id.in_([r.id for r in rows]))  # type: ignore[attr-defined]
        .order_by(SpecTrim.created_at.asc())  # type: ignore[attr-defined]
    )
    trims_by_spec: dict[uuid.UUID, list[SpecTrim]] = {}
    for trim in trims_result.all():
        trims_by_spec.setdefault(trim.spec_id, []).append(trim)
    return [(row, trims_by_spec.get(row.id, [])) for row in rows], total


async def get_spec(db: AsyncSession, *, company_id: uuid.UUID, spec_id: uuid.UUID) -> SpecWithTrims:
    stmt = scoped(select(ProductSpec), ProductSpec, company_id).where(ProductSpec.id == spec_id)
    result = await db.exec(stmt)
    spec = result.first()
    if spec is None:
        raise NotFoundError(detail="Spec not found")
    trims = await _trims_for(db, spec.id)
    return spec, trims


async def create_spec(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    payload: SpecCreate,
) -> SpecWithTrims:
    spec = ProductSpec(
        company_id=company_id,
        code=payload.code,
        name=payload.name,
        fabric_type=payload.fabric_type,
        fabric_grammage_gsm=payload.fabric_grammage_gsm,
        fabric_weight_per_piece_g=payload.fabric_weight_per_piece_g,
        has_ribana=payload.has_ribana,
        ribana_weight_pct=payload.ribana_weight_pct,
        labor_cost=payload.labor_cost,
        sale_price=payload.sale_price if payload.sale_price is not None else 0,
        notes=payload.notes,
    )
    db.add(spec)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError(detail="Spec code already in use for this company") from exc

    for item in payload.trims:
        db.add(
            SpecTrim(
                spec_id=spec.id,
                trim_type=item.trim_type,
                unit_price=item.unit_price,
                quantity=item.quantity,
            )
        )
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="specs",
        resource_id=spec.id,
        message=f"Created spec {spec.code}",
    )
    await db.commit()
    await db.refresh(spec)
    return spec, await _trims_for(db, spec.id)


async def update_spec(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    spec_id: uuid.UUID,
    payload: SpecUpdate,
) -> SpecWithTrims:
    stmt = scoped(select(ProductSpec), ProductSpec, company_id).where(ProductSpec.id == spec_id)
    result = await db.exec(stmt)
    spec = result.first()
    if spec is None:
        raise NotFoundError(detail="Spec not found")

    data = payload.model_dump(exclude_unset=True, exclude={"trims"})
    for field, value in data.items():
        setattr(spec, field, value)

    has_ribana = spec.has_ribana
    ribana_pct = spec.ribana_weight_pct
    if has_ribana and ribana_pct is None:
        raise ValidationError(detail="ribana_weight_pct is required when has_ribana is true")
    if not has_ribana and ribana_pct is not None:
        spec.ribana_weight_pct = None

    db.add(spec)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError(detail="Spec code already in use for this company") from exc

    if payload.trims is not None:
        await db.exec(delete(SpecTrim).where(SpecTrim.spec_id == spec.id))  # type: ignore[arg-type]
        for item in payload.trims:
            db.add(
                SpecTrim(
                    spec_id=spec.id,
                    trim_type=item.trim_type,
                    unit_price=item.unit_price,
                    quantity=item.quantity,
                )
            )
        await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="specs",
        resource_id=spec.id,
        message=f"Updated spec {spec.code}",
    )
    await db.commit()
    await db.refresh(spec)
    return spec, await _trims_for(db, spec.id)


async def delete_spec(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    spec_id: uuid.UUID,
) -> None:
    stmt = scoped(select(ProductSpec), ProductSpec, company_id).where(ProductSpec.id == spec_id)
    result = await db.exec(stmt)
    spec = result.first()
    if spec is None:
        raise NotFoundError(detail="Spec not found")

    in_use = await db.exec(select(func.count()).select_from(Product).where(Product.spec_id == spec.id))
    if int(in_use.first() or 0) > 0:
        raise ConflictError(detail="Cannot delete spec — products are linked to it")

    code = spec.code
    await db.delete(spec)
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="specs",
        resource_id=spec_id,
        message=f"Deleted spec {code}",
    )
    await db.commit()


__all__ = [
    "SpecWithTrims",
    "create_spec",
    "delete_spec",
    "get_spec",
    "list_specs",
    "update_spec",
]
