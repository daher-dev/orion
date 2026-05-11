"""Products (catálogo) HTTP router."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import Product, ProductVariation, User
from models.enums import ProductType
from schemas._common import Page, PageParams
from schemas.product import (
    ProductCreate,
    ProductFilters,
    ProductRead,
    ProductUpdate,
    VariationRead,
)
from services import product as product_service

router = APIRouter(
    prefix="/products",
    tags=["Products"],
    dependencies=[Depends(RequirePermission("products.read"))],
)


def _to_read(product: Product, variations: list[ProductVariation]) -> ProductRead:
    return ProductRead(
        id=product.id,
        company_id=product.company_id,
        name=product.name,
        product_type=product.product_type,
        spec_id=product.spec_id,
        print_id=product.print_id,
        variations=[
            VariationRead(
                id=v.id,
                size=v.size,
                color=v.color,
                color_code=v.color_code,
                sku=v.sku,
                created_at=v.created_at,
                updated_at=v.updated_at,
            )
            for v in variations
        ],
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


@router.get("", response_model=Page[ProductRead])
async def list_products_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("products.read"))],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    q: Annotated[str | None, Query(max_length=120)] = None,
    product_type: Annotated[ProductType | None, Query()] = None,
    spec_id: Annotated[uuid.UUID | None, Query()] = None,
    print_id: Annotated[uuid.UUID | None, Query()] = None,
) -> Page[ProductRead]:
    params = PageParams(page=page, page_size=page_size)
    filters = ProductFilters(
        q=q,
        product_type=product_type,
        spec_id=spec_id,
        print_id=print_id,
    )
    rows, total = await product_service.list_products(
        db,
        company_id=user.company_id,
        filters=filters,
        page=params,
    )
    items = [_to_read(product, variations) for product, variations in rows]
    return Page[ProductRead].build(items=items, total=total, params=params)


@router.get("/{product_id}", response_model=ProductRead)
async def get_product_endpoint(
    product_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("products.read"))],
) -> ProductRead:
    product, variations = await product_service.get_product(
        db,
        company_id=user.company_id,
        product_id=product_id,
    )
    return _to_read(product, variations)


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_product_endpoint(
    payload: ProductCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("products.write"))],
) -> ProductRead:
    product, variations = await product_service.create_product(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return _to_read(product, variations)


@router.patch("/{product_id}", response_model=ProductRead)
async def update_product_endpoint(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("products.write"))],
) -> ProductRead:
    product, variations = await product_service.update_product(
        db,
        company_id=user.company_id,
        user_id=user.id,
        product_id=product_id,
        payload=payload,
    )
    return _to_read(product, variations)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_endpoint(
    product_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("products.write"))],
) -> None:
    await product_service.delete_product(
        db,
        company_id=user.company_id,
        user_id=user.id,
        product_id=product_id,
    )
