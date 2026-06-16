"""Service-layer tests for the Prints (estampas) feature.

Covers every service method (happy + error path), tenant isolation, audit-log
write, and delete-blocked-when-referenced.
"""

import uuid
from decimal import Decimal

import pytest
from sqlmodel import select

from models import AuditLog, PrintDesign, PrintTechnique
from schemas._common import PageParams
from schemas.print_design import PrintCreate, PrintFilters, PrintUpdate
from services.print_design import (
    create_print,
    delete_print,
    get_print,
    list_prints,
    update_print,
)
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import (
    create_company,
    create_print_design,
    create_product,
    create_product_spec,
    create_user,
)


def _payload(**overrides) -> PrintCreate:
    base = {
        "code": f"EST-{uuid.uuid4().hex[:6].upper()}",
        "name": "Aurora — Sol nascente",
        "image_url": None,
        "cost_per_unit": Decimal("4.20"),
    }
    base.update(overrides)
    return PrintCreate(**base)


# ------------------------------------------------------------------ list


async def test_list_prints_returns_only_company_rows(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    await create_print_design(db_session, company_id=company_a.id, code="A1")
    await create_print_design(db_session, company_id=company_a.id, code="A2")
    await create_print_design(db_session, company_id=company_b.id, code="B1")

    rows, total = await list_prints(db_session, company_id=company_a.id)
    assert total == 2
    assert {p.code for p, _variations in rows} == {"A1", "A2"}


async def test_list_prints_filters_by_q_on_code(db_session):
    company = await create_company(db_session)
    await create_print_design(db_session, company_id=company.id, code="EST-FLOR", name="Floral")
    await create_print_design(db_session, company_id=company.id, code="EST-GEO", name="Geometric")

    rows, total = await list_prints(db_session, company_id=company.id, filters=PrintFilters(q="flor"))
    assert total == 1
    assert rows[0][0].code == "EST-FLOR"


async def test_list_prints_filters_by_q_on_name(db_session):
    company = await create_company(db_session)
    await create_print_design(db_session, company_id=company.id, code="EST-001", name="Aurora")
    await create_print_design(db_session, company_id=company.id, code="EST-002", name="Botânica")

    rows, total = await list_prints(db_session, company_id=company.id, filters=PrintFilters(q="aurora"))
    assert total == 1
    assert rows[0][0].name == "Aurora"


async def test_list_prints_paginates(db_session):
    company = await create_company(db_session)
    for i in range(3):
        await create_print_design(db_session, company_id=company.id, code=f"P-{i:02d}")
    rows, total = await list_prints(
        db_session,
        company_id=company.id,
        page=PageParams(page=1, page_size=2),
    )
    assert total == 3
    assert len(rows) == 2


async def test_list_prints_empty_when_no_match(db_session):
    company = await create_company(db_session)
    rows, total = await list_prints(db_session, company_id=company.id)
    assert rows == []
    assert total == 0


# ------------------------------------------------------------------ get


async def test_get_print_happy_path(db_session):
    company = await create_company(db_session)
    print_design = await create_print_design(db_session, company_id=company.id)

    found, variations = await get_print(db_session, company_id=company.id, print_id=print_design.id)
    assert found.id == print_design.id
    assert variations == []


async def test_get_print_404_when_missing(db_session):
    company = await create_company(db_session)
    with pytest.raises(NotFoundError):
        await get_print(db_session, company_id=company.id, print_id=uuid.uuid4())


async def test_get_print_404_when_other_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    print_design = await create_print_design(db_session, company_id=company_a.id)
    with pytest.raises(NotFoundError):
        await get_print(db_session, company_id=company_b.id, print_id=print_design.id)


# ------------------------------------------------------------------ create


async def test_create_print_happy_path(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    payload = _payload(code="EST-NEW", name="Cool art", cost_per_unit=Decimal("3.50"))

    print_design, variations = await create_print(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=payload,
    )
    assert print_design.code == "EST-NEW"
    assert print_design.name == "Cool art"
    assert print_design.company_id == company.id
    assert print_design.cost_per_unit == Decimal("3.50")
    assert variations == []


async def test_create_print_writes_audit_log(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    payload = _payload(code="AUD-1")
    print_design, _ = await create_print(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=payload,
    )

    audit = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == print_design.id))).all()
    assert any("Created print AUD-1" in entry.message for entry in audit)


async def test_create_print_with_image_url(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    payload = _payload(image_url="https://example.com/art.png")

    print_design, _ = await create_print(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=payload,
    )
    assert print_design.image_url == "https://example.com/art.png"


async def test_create_print_defaults_technique_to_dtf(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    print_design, _ = await create_print(db_session, company_id=company.id, user_id=user.id, payload=_payload())
    assert print_design.technique == PrintTechnique.DTF
    assert print_design.tag is None


async def test_create_and_update_print_technique_and_tag(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    created, _ = await create_print(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=_payload(
            technique=PrintTechnique.SILKSCREEN,
            tag="verão",
            image_url_front="https://cdn/f.png",
            width_cm=Decimal("28.00"),
            height_cm=Decimal("35.00"),
        ),
    )
    assert created.technique == PrintTechnique.SILKSCREEN
    assert created.tag == "verão"
    assert created.image_url_front == "https://cdn/f.png"
    assert created.width_cm == Decimal("28.00")

    updated, _ = await update_print(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=created.id,
        payload=PrintUpdate(technique=PrintTechnique.SUBLIMATION, tag="outono"),
    )
    assert updated.technique == PrintTechnique.SUBLIMATION
    assert updated.tag == "outono"


async def test_create_print_rejects_duplicate_code(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    await create_print(db_session, company_id=company.id, user_id=user.id, payload=_payload(code="DUP-1"))
    with pytest.raises(ConflictError):
        await create_print(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=_payload(code="DUP-1"),
        )


async def test_create_print_allows_same_code_in_different_companies(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    p_a, _ = await create_print(db_session, company_id=company_a.id, user_id=None, payload=_payload(code="SHARED"))
    p_b, _ = await create_print(
        db_session,
        company_id=company_b.id,
        user_id=None,
        payload=_payload(code="SHARED"),
    )
    assert p_a.id != p_b.id


# ------------------------------------------------------------------ update


async def test_update_print_happy_path(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    print_design = await create_print_design(db_session, company_id=company.id, code="OLD")

    updated, _ = await update_print(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=print_design.id,
        payload=PrintUpdate(name="Renamed", cost_per_unit=Decimal("9.99")),
    )
    assert updated.name == "Renamed"
    assert updated.cost_per_unit == Decimal("9.99")
    # untouched fields stay the same
    assert updated.code == "OLD"


async def test_update_print_writes_audit_log(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    print_design = await create_print_design(db_session, company_id=company.id, code="AUD-2")
    await update_print(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=print_design.id,
        payload=PrintUpdate(name="New name"),
    )
    audit = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == print_design.id))).all()
    assert any("Updated print AUD-2" in entry.message for entry in audit)


async def test_update_print_404_when_missing(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    with pytest.raises(NotFoundError):
        await update_print(
            db_session,
            company_id=company.id,
            user_id=user.id,
            print_id=uuid.uuid4(),
            payload=PrintUpdate(name="X"),
        )


async def test_update_print_404_when_other_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_b = await create_user(db_session, company_id=company_b.id)
    print_design = await create_print_design(db_session, company_id=company_a.id)
    with pytest.raises(NotFoundError):
        await update_print(
            db_session,
            company_id=company_b.id,
            user_id=user_b.id,
            print_id=print_design.id,
            payload=PrintUpdate(name="X"),
        )


async def test_update_print_409_on_duplicate_code(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    await create_print_design(db_session, company_id=company.id, code="A1")
    second = await create_print_design(db_session, company_id=company.id, code="A2")
    with pytest.raises(ConflictError):
        await update_print(
            db_session,
            company_id=company.id,
            user_id=user.id,
            print_id=second.id,
            payload=PrintUpdate(code="A1"),
        )


async def test_update_print_can_clear_image_url(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    print_design = await create_print_design(
        db_session,
        company_id=company.id,
        image_url="https://example.com/old.png",
    )
    updated, _ = await update_print(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=print_design.id,
        payload=PrintUpdate(image_url=None),
    )
    assert updated.image_url is None


# ------------------------------------------------------------------ delete


async def test_delete_print_happy_path(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    print_design = await create_print_design(db_session, company_id=company.id)

    await delete_print(db_session, company_id=company.id, user_id=user.id, print_id=print_design.id)

    remaining = (await db_session.exec(select(PrintDesign).where(PrintDesign.id == print_design.id))).all()
    assert remaining == []


async def test_delete_print_blocked_when_product_links_to_it(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    print_design = await create_print_design(db_session, company_id=company.id)
    await create_product(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        print_id=print_design.id,
    )

    with pytest.raises(ConflictError):
        await delete_print(
            db_session,
            company_id=company.id,
            user_id=user.id,
            print_id=print_design.id,
        )


async def test_delete_print_404_when_missing(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    with pytest.raises(NotFoundError):
        await delete_print(
            db_session,
            company_id=company.id,
            user_id=user.id,
            print_id=uuid.uuid4(),
        )


async def test_delete_print_404_when_other_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_b = await create_user(db_session, company_id=company_b.id)
    print_design = await create_print_design(db_session, company_id=company_a.id)
    with pytest.raises(NotFoundError):
        await delete_print(
            db_session,
            company_id=company_b.id,
            user_id=user_b.id,
            print_id=print_design.id,
        )


async def test_delete_print_writes_audit_log(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    print_design = await create_print_design(db_session, company_id=company.id, code="DEL-1")
    await delete_print(db_session, company_id=company.id, user_id=user.id, print_id=print_design.id)
    audit = (await db_session.exec(select(AuditLog).where(AuditLog.resource_type == "prints"))).all()
    assert any("Deleted print DEL-1" in entry.message for entry in audit)
