"""Service layer for Products (catálogo).

A Product is the catalog leaf: it composes a spec (recipe) with an optional
print (artwork) and explodes into a matrix of variations. Mutations always
write the active ``company_id`` explicitly and append audit-log entries.

Atomicity contract
------------------
When ``payload.variations`` is provided to :func:`update_product` we delete
every existing :class:`ProductVariation` for the product and insert the new
list in the same flush. This guarantees consumers never observe a half-old /
half-new variation set.

SKU derivation
--------------
SKUs are always derived by :meth:`ProductVariation.make_sku` using the
*current* spec code and (if any) print code — the service does not invent
them. Callers can rely on the format being canonical.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import AdProduct, PrintDesign, Product, ProductSpec, ProductVariation
from schemas._common import PageParams
from schemas.product import ProductCreate, ProductFilters, ProductUpdate, VariationItem
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError, ValidationError

ProductWithVariations = tuple[Product, list[ProductVariation]]


async def _load_spec(db: AsyncSession, *, company_id: uuid.UUID, spec_id: uuid.UUID) -> ProductSpec:
    stmt = scoped(select(ProductSpec), ProductSpec, company_id).where(ProductSpec.id == spec_id)
    spec = (await db.exec(stmt)).first()
    if spec is None:
        raise ValidationError(detail="Spec not found for this company")
    return spec


async def _load_print(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    print_id: uuid.UUID | None,
) -> PrintDesign | None:
    if print_id is None:
        return None
    stmt = scoped(select(PrintDesign), PrintDesign, company_id).where(PrintDesign.id == print_id)
    print_design = (await db.exec(stmt)).first()
    if print_design is None:
        raise ValidationError(detail="Print not found for this company")
    return print_design


async def _variations_for(db: AsyncSession, product_id: uuid.UUID) -> list[ProductVariation]:
    stmt = (
        select(ProductVariation)
        .where(ProductVariation.product_id == product_id)
        .order_by(ProductVariation.created_at.asc())  # type: ignore[attr-defined]
    )
    result = await db.exec(stmt)
    return list(result.all())


def _build_variation(
    *,
    company_id: uuid.UUID,
    product_id: uuid.UUID,
    item: VariationItem,
    spec_code: str,
    print_code: str | None,
) -> ProductVariation:
    sku = ProductVariation.make_sku(spec_code, item.size, item.color_code, print_code)
    return ProductVariation(
        company_id=company_id,
        product_id=product_id,
        size=item.size,
        color=item.color,
        color_code=item.color_code,
        sku=sku,
    )


def _apply_filters(stmt, filters: ProductFilters):
    if filters.q:
        needle = f"%{filters.q.lower()}%"
        stmt = stmt.where(or_(func.lower(Product.name).like(needle)))
    if filters.product_type is not None:
        stmt = stmt.where(Product.product_type == filters.product_type)
    if filters.spec_id is not None:
        stmt = stmt.where(Product.spec_id == filters.spec_id)
    if filters.print_id is not None:
        stmt = stmt.where(Product.print_id == filters.print_id)
    return stmt


# --------------------------------------------------------------------- list


async def list_products(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: ProductFilters | None = None,
    page: PageParams | None = None,
) -> tuple[list[ProductWithVariations], int]:
    filters = filters or ProductFilters()
    page = page or PageParams()

    base = scoped(select(Product), Product, company_id)
    base = _apply_filters(base, filters)

    count_stmt = scoped(select(func.count()).select_from(Product), Product, company_id)
    count_stmt = _apply_filters(count_stmt, filters)
    total = int((await db.exec(count_stmt)).one() or 0)

    rows_stmt = (
        base.order_by(Product.updated_at.desc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    products = list((await db.exec(rows_stmt)).all())
    if not products:
        return [], total

    variations_stmt = (
        select(ProductVariation)
        .where(ProductVariation.product_id.in_([p.id for p in products]))  # type: ignore[attr-defined]
        .order_by(ProductVariation.created_at.asc())  # type: ignore[attr-defined]
    )
    grouped: dict[uuid.UUID, list[ProductVariation]] = {}
    for variation in (await db.exec(variations_stmt)).all():
        grouped.setdefault(variation.product_id, []).append(variation)

    return [(product, grouped.get(product.id, [])) for product in products], total


# ---------------------------------------------------------------------- get


async def get_product(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    product_id: uuid.UUID,
) -> ProductWithVariations:
    stmt = scoped(select(Product), Product, company_id).where(Product.id == product_id)
    product = (await db.exec(stmt)).first()
    if product is None:
        raise NotFoundError(detail="Product not found")
    return product, await _variations_for(db, product.id)


# ------------------------------------------------------------------- create


async def create_product(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    payload: ProductCreate,
) -> ProductWithVariations:
    spec = await _load_spec(db, company_id=company_id, spec_id=payload.spec_id)
    print_design = await _load_print(db, company_id=company_id, print_id=payload.print_id)

    product = Product(
        company_id=company_id,
        name=payload.name,
        product_type=payload.product_type,
        spec_id=spec.id,
        print_id=print_design.id if print_design else None,
    )
    db.add(product)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError(
            detail="A product already exists for this spec + print combination",
        ) from exc

    print_code = print_design.code if print_design else None
    for item in payload.variations:
        db.add(
            _build_variation(
                company_id=company_id,
                product_id=product.id,
                item=item,
                spec_code=spec.code,
                print_code=print_code,
            )
        )
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError(detail="Duplicate variation (size + color)") from exc

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="products",
        resource_id=product.id,
        message=f"Created product {product.name}",
    )
    await db.commit()
    await db.refresh(product)
    return product, await _variations_for(db, product.id)


# ------------------------------------------------------------------- update


async def update_product(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    product_id: uuid.UUID,
    payload: ProductUpdate,
) -> ProductWithVariations:
    stmt = scoped(select(Product), Product, company_id).where(Product.id == product_id)
    product = (await db.exec(stmt)).first()
    if product is None:
        raise NotFoundError(detail="Product not found")

    data = payload.model_dump(exclude_unset=True, exclude={"variations"})
    # spec_id / print_id may change — resolve them up-front so we have codes for
    # SKU derivation later.
    new_spec_id = data.get("spec_id", product.spec_id)
    new_print_id = data.get("print_id", product.print_id) if "print_id" in data else product.print_id

    spec = await _load_spec(db, company_id=company_id, spec_id=new_spec_id)
    print_design = await _load_print(db, company_id=company_id, print_id=new_print_id)

    for field, value in data.items():
        setattr(product, field, value)

    db.add(product)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise ConflictError(
            detail="A product already exists for this spec + print combination",
        ) from exc

    if payload.variations is not None:
        await db.exec(delete(ProductVariation).where(ProductVariation.product_id == product.id))  # type: ignore[arg-type]
        await db.flush()
        print_code = print_design.code if print_design else None
        for item in payload.variations:
            db.add(
                _build_variation(
                    company_id=company_id,
                    product_id=product.id,
                    item=item,
                    spec_code=spec.code,
                    print_code=print_code,
                )
            )
        try:
            await db.flush()
        except IntegrityError as exc:
            await db.rollback()
            raise ConflictError(detail="Duplicate variation (size + color)") from exc

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="products",
        resource_id=product.id,
        message=f"Updated product {product.name}",
    )
    await db.commit()
    await db.refresh(product)
    return product, await _variations_for(db, product.id)


# ------------------------------------------------------------------- delete


async def delete_product(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    product_id: uuid.UUID,
) -> None:
    stmt = scoped(select(Product), Product, company_id).where(Product.id == product_id)
    product = (await db.exec(stmt)).first()
    if product is None:
        raise NotFoundError(detail="Product not found")

    linked_ads = await db.exec(select(func.count()).select_from(AdProduct).where(AdProduct.product_id == product.id))
    if int(linked_ads.first() or 0) > 0:
        raise ConflictError(detail="Cannot delete product — ads are linked to it")

    name = product.name
    await db.delete(product)
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="products",
        resource_id=product_id,
        message=f"Deleted product {name}",
    )
    await db.commit()


__all__ = [
    "ProductWithVariations",
    "create_product",
    "delete_product",
    "get_product",
    "list_products",
    "update_product",
]
