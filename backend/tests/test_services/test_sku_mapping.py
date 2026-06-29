"""Service tests for the marketplace SKU De/Para (``SkuMapping``)."""

import uuid

import pytest
from sqlmodel import select

from models import Ecommerce, Size, SkuMapping
from services.sku_mapping import delete_mapping, list_mappings, upsert_mapping
from shared.exceptions import NotFoundError, ValidationError
from tests.factories import (
    create_ad,
    create_company,
    create_product,
    create_product_spec,
    create_product_variation,
    create_user,
)


async def _seed(db, *, color="Azul", color_code="AZU", size=Size.G):
    company = await create_company(db)
    user = await create_user(db, company_id=company.id, firebase_uid=f"u-{uuid.uuid4().hex[:8]}")
    spec = await create_product_spec(db, company_id=company.id)
    product = await create_product(db, company_id=company.id, spec_id=spec.id)
    variation = await create_product_variation(
        db, company_id=company.id, product_id=product.id, size=size, color=color, color_code=color_code
    )
    ad = await create_ad(db, company_id=company.id, product_id=product.id, title="Ad", external_id="1")
    return company, user, product, variation, ad


async def test_upsert_creates_and_enriches(db_session):
    company, user, product, variation, ad = await _seed(db_session)

    read = await upsert_mapping(
        db_session,
        company_id=company.id,
        user_id=user.id,
        marketplace=Ecommerce.SHOPEE,
        sku="ABC-123",
        ad_id=ad.id,
        variation_id=variation.id,
    )

    assert read.marketplace == Ecommerce.SHOPEE
    assert read.sku == "abc-123"  # normalized (trim + lower)
    assert read.ad_id == ad.id
    assert read.variation_id == variation.id
    assert read.source == "manual"
    # Enriched with resolved catalog context for the UI.
    assert read.ad_title == "Ad"
    assert read.product_name == product.name
    assert read.variation_sku == variation.sku
    assert read.color == "Azul"
    assert read.size == Size.G


async def test_upsert_overwrites_existing_key(db_session):
    company, user, product, variation, ad = await _seed(db_session)
    other = await create_product_variation(
        db_session, company_id=company.id, product_id=product.id, size=Size.M, color="Verde", color_code="GRN"
    )

    await upsert_mapping(
        db_session,
        company_id=company.id,
        user_id=user.id,
        marketplace=Ecommerce.SHOPEE,
        sku="dup",
        ad_id=ad.id,
        variation_id=variation.id,
    )
    read = await upsert_mapping(
        db_session,
        company_id=company.id,
        user_id=user.id,
        marketplace=Ecommerce.SHOPEE,
        sku="dup",
        ad_id=ad.id,
        variation_id=other.id,
    )

    assert read.variation_id == other.id
    rows = (await db_session.exec(select(SkuMapping).where(SkuMapping.company_id == company.id))).all()
    assert len(rows) == 1  # overwrite, not a second row


async def test_upsert_rejects_variation_outside_ad_products(db_session):
    company, user, _product, _variation, ad = await _seed(db_session)
    # A variation of a different product the ad does not sell.
    spec2 = await create_product_spec(db_session, company_id=company.id)
    product2 = await create_product(db_session, company_id=company.id, spec_id=spec2.id)
    foreign = await create_product_variation(
        db_session, company_id=company.id, product_id=product2.id, size=Size.G, color="Preto", color_code="BLK"
    )

    with pytest.raises(ValidationError):
        await upsert_mapping(
            db_session,
            company_id=company.id,
            user_id=user.id,
            marketplace=Ecommerce.SHOPEE,
            sku="x",
            ad_id=ad.id,
            variation_id=foreign.id,
        )


async def test_upsert_rejects_unknown_ad(db_session):
    company, user, _product, variation, _ad = await _seed(db_session)
    with pytest.raises(NotFoundError):
        await upsert_mapping(
            db_session,
            company_id=company.id,
            user_id=user.id,
            marketplace=Ecommerce.SHOPEE,
            sku="x",
            ad_id=uuid.uuid4(),
            variation_id=variation.id,
        )


async def test_list_and_delete(db_session):
    company, user, _product, variation, ad = await _seed(db_session)
    created = await upsert_mapping(
        db_session,
        company_id=company.id,
        user_id=user.id,
        marketplace=Ecommerce.SHEIN,
        sku="keep",
        ad_id=ad.id,
        variation_id=variation.id,
    )

    page = await list_mappings(db_session, company_id=company.id)
    assert page.total == 1
    assert page.items[0].sku == "keep"

    await delete_mapping(db_session, company_id=company.id, user_id=user.id, mapping_id=created.id)
    page2 = await list_mappings(db_session, company_id=company.id)
    assert page2.total == 0
