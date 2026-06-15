"""Service layer for Prints (estampas) + their colour variations.

The print catalog is a flat list of artworks scoped to a company; each estampa
carries an ordered list of colour ``PrintDesignVariation`` children (one ink
colour + per-side PNG, mirroring how ``services.spec`` handles ``SpecTrim``).
Mutations always write ``company_id`` explicitly and append an audit-log entry.
Reads use ``scoped()`` so cross-tenant leaks are structurally impossible.

Variation artwork statuses are server-derived: ``OK`` iff the corresponding
``*_file_url`` is set, else ``PENDING``. Clients never write status directly.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import PrintDesign, PrintDesignVariation, Product
from models.enums import ArtworkStatus, PrintSide
from schemas._common import PageParams
from schemas.print_design import (
    PrintCreate,
    PrintFilters,
    PrintUpdate,
    PrintVariationCreate,
    PrintVariationUpdate,
)
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError

# A loaded print plus its ordered colour variations (the wire shape's children).
PrintWithVariations = tuple[PrintDesign, list[PrintDesignVariation]]


def _status_for(file_url: str | None) -> ArtworkStatus:
    return ArtworkStatus.OK if file_url else ArtworkStatus.PENDING


def _apply_filters(stmt, filters: PrintFilters):
    if filters.q:
        needle = f"%{filters.q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(PrintDesign.code).like(needle),
                func.lower(PrintDesign.name).like(needle),
            )
        )
    return stmt


async def _variations_for(db: AsyncSession, print_design_id: uuid.UUID) -> list[PrintDesignVariation]:
    result = await db.exec(
        select(PrintDesignVariation)
        .where(PrintDesignVariation.print_design_id == print_design_id)
        .order_by(PrintDesignVariation.created_at.asc())  # type: ignore[attr-defined]
    )
    return list(result.all())


async def list_prints(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: PrintFilters | None = None,
    page: PageParams | None = None,
) -> tuple[list[PrintWithVariations], int]:
    filters = filters or PrintFilters()
    page = page or PageParams()

    base = scoped(select(PrintDesign), PrintDesign, company_id)
    base = _apply_filters(base, filters)

    count_stmt = scoped(select(func.count()).select_from(PrintDesign), PrintDesign, company_id)
    count_stmt = _apply_filters(count_stmt, filters)
    total_result = await db.exec(count_stmt)
    total = int(total_result.one() or 0)

    rows_stmt = (
        base.order_by(PrintDesign.created_at.desc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    rows = list((await db.exec(rows_stmt)).all())
    if not rows:
        return [], total

    variations_result = await db.exec(
        select(PrintDesignVariation)
        .where(PrintDesignVariation.print_design_id.in_([r.id for r in rows]))  # type: ignore[attr-defined]
        .order_by(PrintDesignVariation.created_at.asc())  # type: ignore[attr-defined]
    )
    by_design: dict[uuid.UUID, list[PrintDesignVariation]] = {}
    for variation in variations_result.all():
        by_design.setdefault(variation.print_design_id, []).append(variation)

    return [(row, by_design.get(row.id, [])) for row in rows], total


async def get_print(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    print_id: uuid.UUID,
) -> PrintWithVariations:
    stmt = scoped(select(PrintDesign), PrintDesign, company_id).where(PrintDesign.id == print_id)
    result = await db.exec(stmt)
    print_design = result.first()
    if print_design is None:
        raise NotFoundError(detail="Print not found")
    return print_design, await _variations_for(db, print_design.id)


async def create_print(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    payload: PrintCreate,
) -> PrintDesign:
    print_design = PrintDesign(
        company_id=company_id,
        code=payload.code,
        name=payload.name,
        image_url=payload.image_url,
        cost_per_unit=payload.cost_per_unit,
        technique=payload.technique,
        tag=payload.tag,
        has_front=payload.has_front,
        has_back=payload.has_back,
        image_url_front=payload.image_url_front,
        image_url_back=payload.image_url_back,
        width_cm=payload.width_cm,
        height_cm=payload.height_cm,
    )
    db.add(print_design)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError(detail="Print code already in use for this company") from exc

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="prints",
        resource_id=print_design.id,
        message=f"Created print {print_design.code}",
    )
    await db.commit()
    await db.refresh(print_design)
    return print_design, []


async def update_print(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    print_id: uuid.UUID,
    payload: PrintUpdate,
) -> PrintWithVariations:
    print_design, _ = await get_print(db, company_id=company_id, print_id=print_id)

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(print_design, field, value)

    db.add(print_design)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError(detail="Print code already in use for this company") from exc

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="prints",
        resource_id=print_design.id,
        message=f"Updated print {print_design.code}",
    )
    await db.commit()
    await db.refresh(print_design)
    return print_design, await _variations_for(db, print_design.id)


async def delete_print(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    print_id: uuid.UUID,
) -> None:
    print_design, _ = await get_print(db, company_id=company_id, print_id=print_id)

    in_use = await db.exec(select(func.count()).select_from(Product).where(Product.print_id == print_design.id))
    if int(in_use.first() or 0) > 0:
        raise ConflictError(detail="Cannot delete print — products are linked to it")

    code = print_design.code
    await db.delete(print_design)
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="prints",
        resource_id=print_id,
        message=f"Deleted print {code}",
    )
    await db.commit()


# ----------------------------------------------------------------- variations


async def _ensure_print(db: AsyncSession, *, company_id: uuid.UUID, print_id: uuid.UUID) -> PrintDesign:
    stmt = scoped(select(PrintDesign), PrintDesign, company_id).where(PrintDesign.id == print_id)
    print_design = (await db.exec(stmt)).first()
    if print_design is None:
        raise NotFoundError(detail="Print not found")
    return print_design


async def get_variation(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    print_id: uuid.UUID,
    variation_id: uuid.UUID,
) -> PrintDesignVariation:
    stmt = scoped(select(PrintDesignVariation), PrintDesignVariation, company_id).where(
        PrintDesignVariation.id == variation_id,
        PrintDesignVariation.print_design_id == print_id,
    )
    variation = (await db.exec(stmt)).first()
    if variation is None:
        raise NotFoundError(detail="Print variation not found")
    return variation


async def list_variations(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    print_id: uuid.UUID,
) -> list[PrintDesignVariation]:
    await _ensure_print(db, company_id=company_id, print_id=print_id)
    return await _variations_for(db, print_id)


async def create_variation(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    print_id: uuid.UUID,
    payload: PrintVariationCreate,
) -> PrintDesignVariation:
    print_design = await _ensure_print(db, company_id=company_id, print_id=print_id)

    variation = PrintDesignVariation(
        company_id=company_id,
        print_design_id=print_design.id,
        name=payload.name,
        ink_hex=payload.ink_hex,
        front_file_url=payload.front_file_url,
        front_status=_status_for(payload.front_file_url),
        back_file_url=payload.back_file_url,
        back_status=_status_for(payload.back_file_url),
    )
    db.add(variation)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="prints",
        resource_id=print_design.id,
        message=f"Added variation {variation.name} to print {print_design.code}",
    )
    await db.commit()
    await db.refresh(variation)
    return variation


async def update_variation(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    print_id: uuid.UUID,
    variation_id: uuid.UUID,
    payload: PrintVariationUpdate,
) -> PrintDesignVariation:
    variation = await get_variation(db, company_id=company_id, print_id=print_id, variation_id=variation_id)

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(variation, field, value)
    # Re-derive statuses whenever a file url field was part of the update.
    if "front_file_url" in changes:
        variation.front_status = _status_for(variation.front_file_url)
    if "back_file_url" in changes:
        variation.back_status = _status_for(variation.back_file_url)

    db.add(variation)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="prints",
        resource_id=print_id,
        message=f"Updated variation {variation.name}",
    )
    await db.commit()
    await db.refresh(variation)
    return variation


async def delete_variation(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    print_id: uuid.UUID,
    variation_id: uuid.UUID,
) -> None:
    variation = await get_variation(db, company_id=company_id, print_id=print_id, variation_id=variation_id)
    name = variation.name
    await db.delete(variation)
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="prints",
        resource_id=print_id,
        message=f"Removed variation {name}",
    )
    await db.commit()


async def set_variation_artwork(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    print_id: uuid.UUID,
    variation_id: uuid.UUID,
    side: PrintSide,
    file_url: str,
) -> PrintDesignVariation:
    """Set ``{side}_file_url`` + ``{side}_status=OK`` after an artwork upload."""

    variation = await get_variation(db, company_id=company_id, print_id=print_id, variation_id=variation_id)
    if side == PrintSide.FRONT:
        variation.front_file_url = file_url
        variation.front_status = ArtworkStatus.OK
    else:
        variation.back_file_url = file_url
        variation.back_status = ArtworkStatus.OK

    db.add(variation)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="prints",
        resource_id=print_id,
        message=f"Uploaded {side.value} artwork for variation {variation.name}",
    )
    await db.commit()
    await db.refresh(variation)
    return variation


__all__ = [
    "PrintWithVariations",
    "create_print",
    "create_variation",
    "delete_print",
    "delete_variation",
    "get_print",
    "get_variation",
    "list_prints",
    "list_variations",
    "set_variation_artwork",
    "update_print",
    "update_variation",
]
