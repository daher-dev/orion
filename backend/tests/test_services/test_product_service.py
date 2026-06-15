"""Service-layer tests for the Products (catálogo) feature.

Covers every service method (happy + error path), tenant isolation, audit-log
write, atomic variation replacement on update, SKU derivation, and the two
delete blockers (linked Ad).
"""

import uuid

import pytest
from sqlmodel import select

from models import AuditLog, Product, ProductVariation
from models.enums import ProductType, Size
from schemas._common import PageParams
from schemas.product import (
    ProductCreate,
    ProductFilters,
    ProductUpdate,
    VariationItem,
)
from services import product as product_service
from shared.exceptions import ConflictError, NotFoundError, ValidationError
from tests.factories import (
    create_ad,
    create_company,
    create_print_design,
    create_product,
    create_product_spec,
    create_product_variation,
    create_user,
)


def _variation(size: Size = Size.M, color: str = "Preto", color_code: str = "PRT") -> VariationItem:
    return VariationItem(size=size, color=color, color_code=color_code)


def _payload(*, spec_id: uuid.UUID, print_id: uuid.UUID | None = None, **overrides) -> ProductCreate:
    base = {
        "name": "Cropped Oversized",
        "product_type": ProductType.CAMISETA,
        "spec_id": spec_id,
        "print_id": print_id,
        "variations": [
            _variation(Size.P, "Preto", "PRT"),
            _variation(Size.M, "Preto", "PRT"),
        ],
    }
    base.update(overrides)
    return ProductCreate(**base)


# ------------------------------------------------------------------ list


async def test_list_products_returns_only_company_rows(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    spec_a1 = await create_product_spec(db_session, company_id=company_a.id, code="A1")
    spec_a2 = await create_product_spec(db_session, company_id=company_a.id, code="A2")
    spec_b = await create_product_spec(db_session, company_id=company_b.id)
    await create_product(db_session, company_id=company_a.id, spec_id=spec_a1.id, name="A1")
    await create_product(db_session, company_id=company_a.id, spec_id=spec_a2.id, name="A2")
    await create_product(db_session, company_id=company_b.id, spec_id=spec_b.id, name="B1")

    rows, total = await product_service.list_products(db_session, company_id=company_a.id)
    assert total == 2
    assert {p.name for p, _ in rows} == {"A1", "A2"}


async def test_list_products_eager_loads_variations(db_session):
    company = await create_company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    await create_product_variation(db_session, company_id=company.id, product_id=product.id, size=Size.P)
    await create_product_variation(
        db_session,
        company_id=company.id,
        product_id=product.id,
        size=Size.M,
        color_code="OFF",
    )

    rows, _ = await product_service.list_products(db_session, company_id=company.id)
    assert len(rows) == 1
    _product, variations = rows[0]
    assert len(variations) == 2


async def test_list_products_filters_by_q(db_session):
    company = await create_company(db_session)
    spec_a = await create_product_spec(db_session, company_id=company.id, code="FT-A")
    spec_b = await create_product_spec(db_session, company_id=company.id, code="FT-B")
    await create_product(db_session, company_id=company.id, spec_id=spec_a.id, name="Camiseta Crop")
    await create_product(db_session, company_id=company.id, spec_id=spec_b.id, name="Longline Tee")

    rows, total = await product_service.list_products(
        db_session,
        company_id=company.id,
        filters=ProductFilters(q="crop"),
    )
    assert total == 1
    assert rows[0][0].name == "Camiseta Crop"


async def test_list_products_filters_by_type(db_session):
    company = await create_company(db_session)
    spec_a = await create_product_spec(db_session, company_id=company.id, code="FT-T")
    spec_b = await create_product_spec(db_session, company_id=company.id, code="FT-S")
    await create_product(
        db_session, company_id=company.id, spec_id=spec_a.id, product_type=ProductType.CAMISETA, name="T"
    )
    await create_product(
        db_session,
        company_id=company.id,
        spec_id=spec_b.id,
        product_type=ProductType.MOLETOM,
        name="S",
    )

    rows, total = await product_service.list_products(
        db_session,
        company_id=company.id,
        filters=ProductFilters(product_type=ProductType.MOLETOM),
    )
    assert total == 1
    assert rows[0][0].product_type == ProductType.MOLETOM


async def test_list_products_filters_by_spec(db_session):
    company = await create_company(db_session)
    spec_a = await create_product_spec(db_session, company_id=company.id, code="FT-A")
    spec_b = await create_product_spec(db_session, company_id=company.id, code="FT-B")
    await create_product(db_session, company_id=company.id, spec_id=spec_a.id, name="Use-A")
    await create_product(db_session, company_id=company.id, spec_id=spec_b.id, name="Use-B")

    rows, total = await product_service.list_products(
        db_session,
        company_id=company.id,
        filters=ProductFilters(spec_id=spec_a.id),
    )
    assert total == 1
    assert rows[0][0].name == "Use-A"


async def test_list_products_filters_by_print(db_session):
    company = await create_company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    print_a = await create_print_design(db_session, company_id=company.id, code="EST-A")
    await create_product(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        print_id=print_a.id,
        name="With Print",
    )

    rows, total = await product_service.list_products(
        db_session,
        company_id=company.id,
        filters=ProductFilters(print_id=print_a.id),
    )
    assert total == 1
    assert rows[0][0].name == "With Print"


async def test_list_products_paginates(db_session):
    company = await create_company(db_session)
    for i in range(3):
        spec_i = await create_product_spec(db_session, company_id=company.id, code=f"FT-{i:02d}")
        await create_product(
            db_session,
            company_id=company.id,
            spec_id=spec_i.id,
            name=f"P{i}",
        )

    rows, total = await product_service.list_products(
        db_session,
        company_id=company.id,
        page=PageParams(page=1, page_size=2),
    )
    assert total == 3
    assert len(rows) == 2


async def test_list_products_empty_when_no_match(db_session):
    company = await create_company(db_session)
    rows, total = await product_service.list_products(db_session, company_id=company.id)
    assert rows == []
    assert total == 0


# ------------------------------------------------------------------ get


async def test_get_product_happy_path(db_session):
    company = await create_company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    await create_product_variation(db_session, company_id=company.id, product_id=product.id)

    found, variations = await product_service.get_product(db_session, company_id=company.id, product_id=product.id)
    assert found.id == product.id
    assert len(variations) == 1


async def test_get_product_404_when_missing(db_session):
    company = await create_company(db_session)
    with pytest.raises(NotFoundError):
        await product_service.get_product(db_session, company_id=company.id, product_id=uuid.uuid4())


async def test_get_product_404_when_other_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    spec_a = await create_product_spec(db_session, company_id=company_a.id)
    product_a = await create_product(db_session, company_id=company_a.id, spec_id=spec_a.id)
    with pytest.raises(NotFoundError):
        await product_service.get_product(db_session, company_id=company_b.id, product_id=product_a.id)


# ----------------------------------------------------------------- create


async def test_create_product_derives_skus_without_print(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")

    product, variations = await product_service.create_product(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=_payload(
            spec_id=spec.id,
            variations=[
                _variation(Size.P, "Preto", "PRT"),
                _variation(Size.G, "Off-white", "OFF"),
            ],
        ),
    )
    skus = sorted(v.sku for v in variations)
    assert skus == ["CAM01-G-OFF", "CAM01-P-PRT"]
    assert product.company_id == company.id


async def test_create_product_derives_skus_with_print(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM02")
    print_design = await create_print_design(db_session, company_id=company.id, code="FLR03")

    _, variations = await product_service.create_product(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=_payload(
            spec_id=spec.id,
            print_id=print_design.id,
            variations=[_variation(Size.M, "Preto", "PRT")],
        ),
    )
    assert variations[0].sku == "CAM02-M-PRT-FLR03"


async def test_create_product_writes_audit_log(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)

    product, _ = await product_service.create_product(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=_payload(spec_id=spec.id, name="Auditable"),
    )
    audit = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == product.id))).all()
    assert any("Created product Auditable" in entry.message for entry in audit)


async def test_create_product_conflict_on_duplicate_spec_print_pair(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    print_design = await create_print_design(db_session, company_id=company.id)

    await product_service.create_product(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=_payload(spec_id=spec.id, print_id=print_design.id),
    )
    with pytest.raises(ConflictError):
        await product_service.create_product(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=_payload(spec_id=spec.id, print_id=print_design.id),
        )


async def test_create_product_conflict_on_duplicate_spec_no_print(db_session):
    """NULLS NOT DISTINCT — two no-print products on the same spec collide."""

    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)

    await product_service.create_product(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=_payload(spec_id=spec.id, print_id=None),
    )
    with pytest.raises(ConflictError):
        await product_service.create_product(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=_payload(spec_id=spec.id, print_id=None, name="dup-no-print"),
        )


async def test_create_product_validation_when_spec_missing(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    with pytest.raises(ValidationError):
        await product_service.create_product(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=_payload(spec_id=uuid.uuid4()),
        )


async def test_create_product_validation_when_print_belongs_to_other_company(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_a = await create_user(db_session, company_id=company_a.id)
    spec_a = await create_product_spec(db_session, company_id=company_a.id)
    other_print = await create_print_design(db_session, company_id=company_b.id)

    with pytest.raises(ValidationError):
        await product_service.create_product(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            payload=_payload(spec_id=spec_a.id, print_id=other_print.id),
        )


async def test_create_product_rejects_duplicate_variation(db_session):
    """Two cells with identical (size, color_code) trip the unique index."""

    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)

    with pytest.raises(ConflictError):
        await product_service.create_product(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=_payload(
                spec_id=spec.id,
                variations=[
                    _variation(Size.M, "Preto", "PRT"),
                    _variation(Size.M, "Preto", "PRT"),
                ],
            ),
        )


# ----------------------------------------------------------------- update


async def test_update_product_renames(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id, name="Old")

    updated, _ = await product_service.update_product(
        db_session,
        company_id=company.id,
        user_id=user.id,
        product_id=product.id,
        payload=ProductUpdate(name="Renamed"),
    )
    assert updated.name == "Renamed"


async def test_update_product_replaces_variations_atomically(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM03")
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    await create_product_variation(
        db_session,
        company_id=company.id,
        product_id=product.id,
        size=Size.P,
        color_code="PRT",
    )
    await create_product_variation(
        db_session,
        company_id=company.id,
        product_id=product.id,
        size=Size.M,
        color_code="PRT",
    )

    _, variations = await product_service.update_product(
        db_session,
        company_id=company.id,
        user_id=user.id,
        product_id=product.id,
        payload=ProductUpdate(
            variations=[
                _variation(Size.G, "Off-white", "OFF"),
                _variation(Size.GG, "Off-white", "OFF"),
            ],
        ),
    )
    assert {v.size for v in variations} == {Size.G, Size.GG}
    skus = {v.sku for v in variations}
    assert skus == {"CAM03-G-OFF", "CAM03-GG-OFF"}

    # Old variations are gone.
    remaining = (await db_session.exec(select(ProductVariation).where(ProductVariation.product_id == product.id))).all()
    assert len(remaining) == 2


async def test_update_product_writes_audit_log(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id, name="AudP")

    await product_service.update_product(
        db_session,
        company_id=company.id,
        user_id=user.id,
        product_id=product.id,
        payload=ProductUpdate(name="AudP-renamed"),
    )
    audit = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == product.id))).all()
    assert any("Updated product AudP-renamed" in entry.message for entry in audit)


async def test_update_product_404_when_missing(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    with pytest.raises(NotFoundError):
        await product_service.update_product(
            db_session,
            company_id=company.id,
            user_id=user.id,
            product_id=uuid.uuid4(),
            payload=ProductUpdate(name="x"),
        )


async def test_update_product_409_on_spec_print_conflict(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    print_a = await create_print_design(db_session, company_id=company.id, code="EST-A")
    print_b = await create_print_design(db_session, company_id=company.id, code="EST-B")
    # Existing product on (spec, print_a)
    await create_product(db_session, company_id=company.id, spec_id=spec.id, print_id=print_a.id, name="A")
    # Other product on (spec, print_b), which we'll try to move to print_a.
    target = await create_product(db_session, company_id=company.id, spec_id=spec.id, print_id=print_b.id, name="B")
    with pytest.raises(ConflictError):
        await product_service.update_product(
            db_session,
            company_id=company.id,
            user_id=user.id,
            product_id=target.id,
            payload=ProductUpdate(print_id=print_a.id),
        )


async def test_update_product_validation_when_spec_missing(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)

    with pytest.raises(ValidationError):
        await product_service.update_product(
            db_session,
            company_id=company.id,
            user_id=user.id,
            product_id=product.id,
            payload=ProductUpdate(spec_id=uuid.uuid4()),
        )


async def test_update_product_clear_print_id(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    print_design = await create_print_design(db_session, company_id=company.id)
    product = await create_product(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        print_id=print_design.id,
    )

    updated, _ = await product_service.update_product(
        db_session,
        company_id=company.id,
        user_id=user.id,
        product_id=product.id,
        payload=ProductUpdate(print_id=None, variations=[_variation(Size.M)]),
    )
    assert updated.print_id is None


# ----------------------------------------------------------------- delete


async def test_delete_product_happy_path(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)

    await product_service.delete_product(db_session, company_id=company.id, user_id=user.id, product_id=product.id)
    remaining = (await db_session.exec(select(Product).where(Product.id == product.id))).all()
    assert remaining == []


async def test_delete_product_blocked_when_ad_links_to_it(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    await create_ad(db_session, company_id=company.id, product_id=product.id)

    with pytest.raises(ConflictError):
        await product_service.delete_product(
            db_session,
            company_id=company.id,
            user_id=user.id,
            product_id=product.id,
        )


async def test_delete_product_404_when_missing(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    with pytest.raises(NotFoundError):
        await product_service.delete_product(
            db_session,
            company_id=company.id,
            user_id=user.id,
            product_id=uuid.uuid4(),
        )


async def test_delete_product_404_when_other_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_b = await create_user(db_session, company_id=company_b.id)
    spec_a = await create_product_spec(db_session, company_id=company_a.id)
    product_a = await create_product(db_session, company_id=company_a.id, spec_id=spec_a.id)

    with pytest.raises(NotFoundError):
        await product_service.delete_product(
            db_session,
            company_id=company_b.id,
            user_id=user_b.id,
            product_id=product_a.id,
        )


async def test_delete_product_writes_audit_log(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id, name="DelMe")

    await product_service.delete_product(db_session, company_id=company.id, user_id=user.id, product_id=product.id)
    audit = (await db_session.exec(select(AuditLog).where(AuditLog.resource_type == "products"))).all()
    assert any("Deleted product DelMe" in entry.message for entry in audit)
