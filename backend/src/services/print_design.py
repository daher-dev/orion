"""Service layer for Prints (estampas).

The print catalog is the simplest of the catalog leaves: a flat list of
artworks scoped to a company. Mutations always write ``company_id`` explicitly
and append an audit-log entry. Reads use ``scoped()`` so cross-tenant leaks
are structurally impossible.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import PrintDesign, Product
from schemas._common import PageParams
from schemas.print_design import PrintCreate, PrintFilters, PrintUpdate
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError


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


async def list_prints(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: PrintFilters | None = None,
    page: PageParams | None = None,
) -> tuple[list[PrintDesign], int]:
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
    rows_result = await db.exec(rows_stmt)
    return list(rows_result.all()), total


async def get_print(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    print_id: uuid.UUID,
) -> PrintDesign:
    stmt = scoped(select(PrintDesign), PrintDesign, company_id).where(PrintDesign.id == print_id)
    result = await db.exec(stmt)
    print_design = result.first()
    if print_design is None:
        raise NotFoundError(detail="Print not found")
    return print_design


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
    return print_design


async def update_print(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    print_id: uuid.UUID,
    payload: PrintUpdate,
) -> PrintDesign:
    print_design = await get_print(db, company_id=company_id, print_id=print_id)

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
    return print_design


async def delete_print(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    print_id: uuid.UUID,
) -> None:
    print_design = await get_print(db, company_id=company_id, print_id=print_id)

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


__all__ = [
    "create_print",
    "delete_print",
    "get_print",
    "list_prints",
    "update_print",
]
