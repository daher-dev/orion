import uuid

import pytest
from sqlmodel import select

from models import Ad, AuditLog, Ecommerce
from schemas._common import PageParams
from schemas.ad import AdCreate, AdFilters, AdUpdate
from services.ad import create_ad, delete_ad, get_ad, list_ads, update_ad
from shared.exceptions import ConflictError, NotFoundError, ValidationError
from tests.factories import (
    create_ad as factory_create_ad,
)
from tests.factories import (
    create_client,
    create_company,
    create_order,
    create_product,
    create_product_spec,
    create_product_variation,
    create_user,
)


async def _company_user(db_session, **company_kwargs):
    company = await create_company(db_session, **company_kwargs)
    user = await create_user(db_session, company_id=company.id)
    return company, user


async def _product_with_spec(db_session, *, company_id: uuid.UUID, **overrides):
    spec = await create_product_spec(db_session, company_id=company_id)
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id, **overrides)
    return product, spec


# ----------------------------------------------------------------- create


async def test_create_ad_persists_and_audits(db_session):
    company, user = await _company_user(db_session)
    product, _ = await _product_with_spec(db_session, company_id=company.id)

    ad, products = await create_ad(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=AdCreate(
            title="Cropped Verão 2026",
            ecommerce=Ecommerce.SHOPEE,
            external_id="SH-AD-99",
            product_ids=[product.id],
        ),
    )
    assert ad.id is not None
    assert ad.company_id == company.id
    assert ad.ecommerce == Ecommerce.SHOPEE
    assert [p.id for p in products] == [product.id]
    assert products[0].code  # spec.code surfaced

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == ad.id))).all()
    assert any("Created ad Cropped Verão 2026" in a.message for a in audits)


async def test_create_ad_links_multiple_products(db_session):
    company, user = await _company_user(db_session)
    p1, _ = await _product_with_spec(db_session, company_id=company.id, name="Alpha")
    p2, _ = await _product_with_spec(db_session, company_id=company.id, name="Beta")

    _, products = await create_ad(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=AdCreate(
            title="Combo listing",
            ecommerce=Ecommerce.SHOPEE,
            external_id=None,
            product_ids=[p1.id, p2.id],
        ),
    )
    assert {p.id for p in products} == {p1.id, p2.id}


async def test_create_ad_rejects_unknown_product(db_session):
    company, user = await _company_user(db_session)
    with pytest.raises(ValidationError):
        await create_ad(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=AdCreate(
                title="X",
                ecommerce=Ecommerce.SHOPEE,
                external_id=None,
                product_ids=[uuid.uuid4()],
            ),
        )


async def test_create_ad_rejects_product_from_other_tenant(db_session):
    company_a, user_a = await _company_user(db_session)
    company_b = await create_company(db_session)
    other_product, _ = await _product_with_spec(db_session, company_id=company_b.id)

    with pytest.raises(ValidationError):
        await create_ad(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            payload=AdCreate(
                title="X",
                ecommerce=Ecommerce.SHOPEE,
                external_id=None,
                product_ids=[other_product.id],
            ),
        )


async def test_create_ad_allows_optional_external_id(db_session):
    company, user = await _company_user(db_session)
    product, _ = await _product_with_spec(db_session, company_id=company.id)

    ad, _ = await create_ad(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=AdCreate(
            title="No external id",
            ecommerce=Ecommerce.INSTAGRAM,
            external_id=None,
            product_ids=[product.id],
        ),
    )
    assert ad.external_id is None


# -------------------------------------------------------------------- get


async def test_get_ad_returns_product_and_code(db_session):
    company, _ = await _company_user(db_session)
    product, spec = await _product_with_spec(db_session, company_id=company.id)
    ad = await factory_create_ad(db_session, company_id=company.id, product_id=product.id, title="A1")

    fetched_ad, products = await get_ad(db_session, company_id=company.id, ad_id=ad.id)
    assert fetched_ad.id == ad.id
    assert products[0].id == product.id
    assert products[0].code == spec.code


async def test_get_ad_raises_not_found_for_missing(db_session):
    company, _ = await _company_user(db_session)
    with pytest.raises(NotFoundError):
        await get_ad(db_session, company_id=company.id, ad_id=uuid.uuid4())


async def test_get_ad_does_not_leak_across_tenants(db_session):
    company_a, _ = await _company_user(db_session)
    company_b = await create_company(db_session)
    other_product, _ = await _product_with_spec(db_session, company_id=company_b.id)
    other_ad = await factory_create_ad(db_session, company_id=company_b.id, product_id=other_product.id)

    with pytest.raises(NotFoundError):
        await get_ad(db_session, company_id=company_a.id, ad_id=other_ad.id)


# ------------------------------------------------------------------- list


async def test_list_ads_returns_only_tenant_rows(db_session):
    company_a, _ = await _company_user(db_session)
    company_b = await create_company(db_session)
    product_a, _ = await _product_with_spec(db_session, company_id=company_a.id)
    product_b, _ = await _product_with_spec(db_session, company_id=company_b.id)
    await factory_create_ad(db_session, company_id=company_a.id, product_id=product_a.id, title="Mine")
    await factory_create_ad(db_session, company_id=company_b.id, product_id=product_b.id, title="Theirs")

    rows, total = await list_ads(
        db_session,
        company_id=company_a.id,
        filters=AdFilters(),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0][0].title == "Mine"


async def test_list_ads_eager_loads_product(db_session):
    company, _ = await _company_user(db_session)
    product, spec = await _product_with_spec(db_session, company_id=company.id, name="Cropped Oversized")
    await factory_create_ad(db_session, company_id=company.id, product_id=product.id)

    rows, _ = await list_ads(
        db_session,
        company_id=company.id,
        filters=AdFilters(),
        page=PageParams(),
    )
    assert len(rows) == 1
    _, products = rows[0]
    assert products[0].name == "Cropped Oversized"
    assert products[0].code == spec.code


async def test_list_ads_filters_by_channel(db_session):
    company, _ = await _company_user(db_session)
    product, _ = await _product_with_spec(db_session, company_id=company.id)
    await factory_create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        ecommerce=Ecommerce.SHOPEE,
        title="On Shopee",
    )
    await factory_create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        ecommerce=Ecommerce.INSTAGRAM,
        title="On IG",
    )

    rows, total = await list_ads(
        db_session,
        company_id=company.id,
        filters=AdFilters(ecommerce=Ecommerce.INSTAGRAM),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0][0].title == "On IG"


async def test_list_ads_filters_by_product(db_session):
    company, _ = await _company_user(db_session)
    product1, _ = await _product_with_spec(db_session, company_id=company.id)
    product2, _ = await _product_with_spec(db_session, company_id=company.id)
    await factory_create_ad(db_session, company_id=company.id, product_id=product1.id, title="A1")
    await factory_create_ad(db_session, company_id=company.id, product_id=product2.id, title="A2")

    rows, total = await list_ads(
        db_session,
        company_id=company.id,
        filters=AdFilters(product_id=product2.id),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0][0].title == "A2"


async def test_list_ads_filters_by_search_text(db_session):
    company, _ = await _company_user(db_session)
    product, _ = await _product_with_spec(db_session, company_id=company.id, name="Tank Top")
    await factory_create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        title="Tank Verão",
        external_id="SH-99",
    )
    await factory_create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        title="Cropped",
        external_id="ML-7",
    )

    # Match via title
    rows, total = await list_ads(
        db_session,
        company_id=company.id,
        filters=AdFilters(q="tank"),
        page=PageParams(),
    )
    assert total == 2  # both ads link to product whose name contains "Tank"

    # Match via external_id
    rows, total = await list_ads(
        db_session,
        company_id=company.id,
        filters=AdFilters(q="ml-7"),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0][0].title == "Cropped"


async def test_list_ads_paginates(db_session):
    company, _ = await _company_user(db_session)
    product, _ = await _product_with_spec(db_session, company_id=company.id)
    for i in range(5):
        await factory_create_ad(
            db_session,
            company_id=company.id,
            product_id=product.id,
            title=f"Ad {i}",
        )

    rows, total = await list_ads(
        db_session,
        company_id=company.id,
        filters=AdFilters(),
        page=PageParams(page=1, page_size=2),
    )
    assert total == 5
    assert len(rows) == 2

    rows_p3, _ = await list_ads(
        db_session,
        company_id=company.id,
        filters=AdFilters(),
        page=PageParams(page=3, page_size=2),
    )
    assert len(rows_p3) == 1


# ----------------------------------------------------------------- update


async def test_update_ad_changes_fields_and_audits(db_session):
    company, user = await _company_user(db_session)
    product, _ = await _product_with_spec(db_session, company_id=company.id)
    ad = await factory_create_ad(db_session, company_id=company.id, product_id=product.id, title="Old")

    updated, _ = await update_ad(
        db_session,
        company_id=company.id,
        user_id=user.id,
        ad_id=ad.id,
        payload=AdUpdate(title="New", ecommerce=Ecommerce.WHATSAPP),
    )
    assert updated.title == "New"
    assert updated.ecommerce == Ecommerce.WHATSAPP

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == ad.id))).all()
    assert any("Updated ad New" in a.message for a in audits)


async def test_update_ad_can_replace_products(db_session):
    company, user = await _company_user(db_session)
    product1, _ = await _product_with_spec(db_session, company_id=company.id)
    product2, _ = await _product_with_spec(db_session, company_id=company.id, name="Other")
    ad = await factory_create_ad(db_session, company_id=company.id, product_id=product1.id, title="A")

    _, products = await update_ad(
        db_session,
        company_id=company.id,
        user_id=user.id,
        ad_id=ad.id,
        payload=AdUpdate(product_ids=[product2.id]),
    )
    assert [p.id for p in products] == [product2.id]


async def test_update_ad_rejects_product_from_other_tenant(db_session):
    company_a, user_a = await _company_user(db_session)
    product_a, _ = await _product_with_spec(db_session, company_id=company_a.id)
    ad = await factory_create_ad(db_session, company_id=company_a.id, product_id=product_a.id, title="A")

    company_b = await create_company(db_session)
    other_product, _ = await _product_with_spec(db_session, company_id=company_b.id)

    with pytest.raises(ValidationError):
        await update_ad(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            ad_id=ad.id,
            payload=AdUpdate(product_ids=[other_product.id]),
        )


async def test_update_ad_raises_when_not_found(db_session):
    company, user = await _company_user(db_session)
    with pytest.raises(NotFoundError):
        await update_ad(
            db_session,
            company_id=company.id,
            user_id=user.id,
            ad_id=uuid.uuid4(),
            payload=AdUpdate(title="X"),
        )


async def test_update_ad_does_not_cross_tenants(db_session):
    company_a, user_a = await _company_user(db_session)
    company_b = await create_company(db_session)
    other_product, _ = await _product_with_spec(db_session, company_id=company_b.id)
    other_ad = await factory_create_ad(db_session, company_id=company_b.id, product_id=other_product.id)

    with pytest.raises(NotFoundError):
        await update_ad(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            ad_id=other_ad.id,
            payload=AdUpdate(title="hacked"),
        )


async def test_update_ad_partial_keeps_other_fields(db_session):
    company, user = await _company_user(db_session)
    product, _ = await _product_with_spec(db_session, company_id=company.id)
    ad = await factory_create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        title="Same",
        ecommerce=Ecommerce.SHOPIFY,
    )

    updated, _ = await update_ad(
        db_session,
        company_id=company.id,
        user_id=user.id,
        ad_id=ad.id,
        payload=AdUpdate(external_id="SH-12"),
    )
    assert updated.title == "Same"
    assert updated.ecommerce == Ecommerce.SHOPIFY
    assert updated.external_id == "SH-12"


# ----------------------------------------------------------------- delete


async def test_delete_ad_removes_row_and_audits(db_session):
    company, user = await _company_user(db_session)
    product, _ = await _product_with_spec(db_session, company_id=company.id)
    ad = await factory_create_ad(db_session, company_id=company.id, product_id=product.id, title="Doomed")

    await delete_ad(db_session, company_id=company.id, user_id=user.id, ad_id=ad.id)

    remaining = (await db_session.exec(select(Ad).where(Ad.id == ad.id))).first()
    assert remaining is None

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == ad.id))).all()
    assert any("Deleted ad Doomed" in a.message for a in audits)


async def test_delete_ad_raises_when_not_found(db_session):
    company, user = await _company_user(db_session)
    with pytest.raises(NotFoundError):
        await delete_ad(
            db_session,
            company_id=company.id,
            user_id=user.id,
            ad_id=uuid.uuid4(),
        )


async def test_delete_ad_does_not_cross_tenants(db_session):
    company_a, user_a = await _company_user(db_session)
    company_b = await create_company(db_session)
    other_product, _ = await _product_with_spec(db_session, company_id=company_b.id)
    other_ad = await factory_create_ad(db_session, company_id=company_b.id, product_id=other_product.id)

    with pytest.raises(NotFoundError):
        await delete_ad(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            ad_id=other_ad.id,
        )


async def test_delete_ad_blocked_when_orders_reference_it(db_session):
    company, user = await _company_user(db_session)
    product, _ = await _product_with_spec(db_session, company_id=company.id)
    variation = await create_product_variation(db_session, company_id=company.id, product_id=product.id)
    client = await create_client(db_session, company_id=company.id)
    ad = await factory_create_ad(db_session, company_id=company.id, product_id=product.id)
    await create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )

    with pytest.raises(ConflictError):
        await delete_ad(
            db_session,
            company_id=company.id,
            user_id=user.id,
            ad_id=ad.id,
        )

    still_there = (await db_session.exec(select(Ad).where(Ad.id == ad.id))).first()
    assert still_there is not None
