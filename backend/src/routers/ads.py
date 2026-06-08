"""Ads (anúncios) HTTP router."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import Ad, User
from models.enums import Ecommerce
from schemas._common import PageParams
from schemas.ad import (
    AdCreate,
    AdFilters,
    AdPage,
    AdProductMini,
    AdRead,
    AdUpdate,
)
from services import ad as ad_service

router = APIRouter(
    prefix="/ads",
    tags=["Ads"],
    dependencies=[Depends(RequirePermission("ads.read"))],
)


def _to_read(ad: Ad, products: list[AdProductMini]) -> AdRead:
    return AdRead(
        id=ad.id,
        title=ad.title,
        ecommerce=ad.ecommerce,
        external_id=ad.external_id,
        products=products,
        created_at=ad.created_at,
        updated_at=ad.updated_at,
    )


@router.get("", response_model=AdPage)
async def list_ads_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("ads.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    ecommerce: Annotated[Ecommerce | None, Query()] = None,
    product_id: Annotated[uuid.UUID | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> AdPage:
    params = PageParams(page=page, page_size=page_size)
    filters = AdFilters(q=q, ecommerce=ecommerce, product_id=product_id)
    rows, total = await ad_service.list_ads(
        db,
        company_id=user.company_id,
        filters=filters,
        page=params,
    )
    items = [_to_read(ad, products) for ad, products in rows]
    return AdPage.build(items=items, total=total, params=params)


@router.get("/{ad_id}", response_model=AdRead)
async def get_ad_endpoint(
    ad_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("ads.read"))],
) -> AdRead:
    ad, products = await ad_service.get_ad(
        db,
        company_id=user.company_id,
        ad_id=ad_id,
    )
    return _to_read(ad, products)


@router.post("", response_model=AdRead, status_code=status.HTTP_201_CREATED)
async def create_ad_endpoint(
    payload: AdCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("ads.write"))],
) -> AdRead:
    ad, products = await ad_service.create_ad(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return _to_read(ad, products)


@router.patch("/{ad_id}", response_model=AdRead)
async def update_ad_endpoint(
    ad_id: uuid.UUID,
    payload: AdUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("ads.write"))],
) -> AdRead:
    ad, products = await ad_service.update_ad(
        db,
        company_id=user.company_id,
        user_id=user.id,
        ad_id=ad_id,
        payload=payload,
    )
    return _to_read(ad, products)


@router.delete("/{ad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ad_endpoint(
    ad_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("ads.write"))],
) -> None:
    await ad_service.delete_ad(
        db,
        company_id=user.company_id,
        user_id=user.id,
        ad_id=ad_id,
    )
