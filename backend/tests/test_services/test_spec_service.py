"""Service-layer tests for the Specs feature.

Covers every service method (happy + error path), tenant isolation, audit-log
write, and the trim-list replacement contract on update.
"""

import uuid
from decimal import Decimal

import pytest
from sqlmodel import select

from models import AuditLog, ProductSpec, SpecTrim
from models.enums import FabricType, TrimType
from schemas._common import PageParams
from schemas.spec import SpecCreate, SpecFilters, SpecUpdate, TrimItem
from services.spec import (
    create_spec,
    delete_spec,
    get_spec,
    list_specs,
    update_spec,
)
from shared.exceptions import ConflictError, NotFoundError, ValidationError
from tests.factories import (
    create_company,
    create_product,
    create_product_spec,
    create_spec_trim,
    create_user,
)


def _payload(**overrides) -> SpecCreate:
    base = {
        "code": f"FT-{uuid.uuid4().hex[:6].upper()}",
        "name": "Cropped Jersey",
        "fabric_type": FabricType.JERSEY,
        "fabric_grammage_gsm": 180,
        "fabric_weight_per_piece_g": Decimal("250.00"),
        "has_ribana": False,
        "ribana_weight_pct": None,
        "labor_cost": Decimal("12.00"),
        "sale_price": Decimal("99.00"),
        "trims": [],
    }
    base.update(overrides)
    return SpecCreate(**base)


# ------------------------------------------------------------------ list


async def test_list_specs_returns_only_company_rows(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    await create_product_spec(db_session, company_id=company_a.id, code="A1", name="A One")
    await create_product_spec(db_session, company_id=company_a.id, code="A2", name="A Two")
    await create_product_spec(db_session, company_id=company_b.id, code="B1", name="B One")

    rows, total = await list_specs(db_session, company_id=company_a.id)
    assert total == 2
    assert {spec.code for spec, _ in rows} == {"A1", "A2"}


async def test_list_specs_eager_loads_trims(db_session):
    company = await create_company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="FT-001")
    await create_spec_trim(db_session, spec_id=spec.id, trim_type=TrimType.LABEL)
    await create_spec_trim(db_session, spec_id=spec.id, trim_type=TrimType.BUTTON)

    rows, _total = await list_specs(db_session, company_id=company.id)
    assert len(rows) == 1
    _spec, trims = rows[0]
    assert len(trims) == 2
    assert {t.trim_type for t in trims} == {TrimType.LABEL, TrimType.BUTTON}


async def test_list_specs_filters_by_q(db_session):
    company = await create_company(db_session)
    await create_product_spec(db_session, company_id=company.id, code="FT-CROP", name="Cropped")
    await create_product_spec(db_session, company_id=company.id, code="FT-LONG", name="Longline")

    rows, total = await list_specs(db_session, company_id=company.id, filters=SpecFilters(q="crop"))
    assert total == 1
    assert rows[0][0].code == "FT-CROP"


async def test_list_specs_filters_by_fabric_type(db_session):
    company = await create_company(db_session)
    await create_product_spec(db_session, company_id=company.id, code="J1", fabric_type=FabricType.JERSEY)
    await create_product_spec(db_session, company_id=company.id, code="F1", fabric_type=FabricType.FLEECE)

    rows, total = await list_specs(
        db_session,
        company_id=company.id,
        filters=SpecFilters(fabric_type=FabricType.FLEECE),
    )
    assert total == 1
    assert rows[0][0].fabric_type == FabricType.FLEECE


async def test_list_specs_paginates(db_session):
    company = await create_company(db_session)
    for i in range(3):
        await create_product_spec(db_session, company_id=company.id, code=f"P-{i:02d}")
    rows, total = await list_specs(
        db_session,
        company_id=company.id,
        page=PageParams(page=1, page_size=2),
    )
    assert total == 3
    assert len(rows) == 2


async def test_list_specs_returns_empty_when_no_match(db_session):
    company = await create_company(db_session)
    rows, total = await list_specs(db_session, company_id=company.id)
    assert rows == []
    assert total == 0


# ------------------------------------------------------------------ get


async def test_get_spec_with_trims(db_session):
    company = await create_company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    await create_spec_trim(db_session, spec_id=spec.id, trim_type=TrimType.ZIPPER)

    found, trims = await get_spec(db_session, company_id=company.id, spec_id=spec.id)
    assert found.id == spec.id
    assert len(trims) == 1
    assert trims[0].trim_type == TrimType.ZIPPER


async def test_get_spec_404_when_missing(db_session):
    company = await create_company(db_session)
    with pytest.raises(NotFoundError):
        await get_spec(db_session, company_id=company.id, spec_id=uuid.uuid4())


async def test_get_spec_404_when_other_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    spec = await create_product_spec(db_session, company_id=company_a.id)
    with pytest.raises(NotFoundError):
        await get_spec(db_session, company_id=company_b.id, spec_id=spec.id)


# ------------------------------------------------------------------ create


async def test_create_spec_happy_path_inserts_trims_and_audits(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)

    payload = _payload(
        trims=[
            TrimItem(trim_type=TrimType.LABEL, unit_price=Decimal("0.50"), quantity=2),
            TrimItem(trim_type=TrimType.BUTTON, unit_price=Decimal("0.85"), quantity=6),
        ],
    )
    spec, trims = await create_spec(db_session, company_id=company.id, user_id=user.id, payload=payload)
    assert spec.code == payload.code
    assert spec.company_id == company.id
    assert len(trims) == 2

    audit = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == spec.id))).all()
    assert any("Created spec" in entry.message for entry in audit)


async def test_create_spec_with_ribana(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    payload = _payload(has_ribana=True, ribana_weight_pct=Decimal("12.5"))
    spec, _trims = await create_spec(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=payload,
    )
    assert spec.has_ribana is True
    assert spec.ribana_weight_pct == Decimal("12.50")


async def test_create_spec_rejects_duplicate_code(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    payload = _payload(code="DUP-1")
    await create_spec(db_session, company_id=company.id, user_id=user.id, payload=payload)
    with pytest.raises(ConflictError):
        await create_spec(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=_payload(code="DUP-1"),
        )


async def test_create_spec_allows_same_code_in_different_companies(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    payload = _payload(code="SHARED")
    s_a, _ = await create_spec(db_session, company_id=company_a.id, user_id=None, payload=payload)
    s_b, _ = await create_spec(
        db_session,
        company_id=company_b.id,
        user_id=None,
        payload=_payload(code="SHARED"),
    )
    assert s_a.id != s_b.id


def test_create_spec_validation_ribana_pct_required():
    with pytest.raises(ValueError, match="ribana_weight_pct is required"):
        _payload(has_ribana=True, ribana_weight_pct=None)


def test_create_spec_validation_ribana_pct_must_be_empty_when_off():
    with pytest.raises(ValueError, match="must be empty"):
        _payload(has_ribana=False, ribana_weight_pct=Decimal("5.00"))


# ------------------------------------------------------------------ update


async def test_update_spec_replaces_trims_atomically(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    create_payload = _payload(
        trims=[TrimItem(trim_type=TrimType.LABEL, unit_price=Decimal("0.5"), quantity=1)],
    )
    spec, trims = await create_spec(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=create_payload,
    )
    assert len(trims) == 1

    new_trims = [
        TrimItem(trim_type=TrimType.BUTTON, unit_price=Decimal("0.40"), quantity=4),
        TrimItem(trim_type=TrimType.ZIPPER, unit_price=Decimal("3.00"), quantity=1),
        TrimItem(trim_type=TrimType.SNAP, unit_price=Decimal("0.20"), quantity=2),
    ]
    _spec, updated_trims = await update_spec(
        db_session,
        company_id=company.id,
        user_id=user.id,
        spec_id=spec.id,
        payload=SpecUpdate(trims=new_trims),
    )
    assert len(updated_trims) == 3
    assert {t.trim_type for t in updated_trims} == {TrimType.BUTTON, TrimType.ZIPPER, TrimType.SNAP}

    db_trims = (await db_session.exec(select(SpecTrim).where(SpecTrim.spec_id == spec.id))).all()
    assert len(db_trims) == 3


async def test_update_spec_keeps_trims_when_not_provided(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="KEEP")
    await create_spec_trim(db_session, spec_id=spec.id, trim_type=TrimType.HOOK)

    _, trims = await update_spec(
        db_session,
        company_id=company.id,
        user_id=user.id,
        spec_id=spec.id,
        payload=SpecUpdate(name="Renamed"),
    )
    assert len(trims) == 1


async def test_update_spec_clears_ribana_pct_when_flag_disabled(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(
        db_session,
        company_id=company.id,
        has_ribana=True,
        ribana_weight_pct=Decimal("10.00"),
    )

    updated, _ = await update_spec(
        db_session,
        company_id=company.id,
        user_id=user.id,
        spec_id=spec.id,
        payload=SpecUpdate(has_ribana=False),
    )
    assert updated.has_ribana is False
    assert updated.ribana_weight_pct is None


async def test_update_spec_rejects_ribana_flag_without_pct(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)

    with pytest.raises(ValidationError):
        await update_spec(
            db_session,
            company_id=company.id,
            user_id=user.id,
            spec_id=spec.id,
            payload=SpecUpdate(has_ribana=True),
        )


async def test_update_spec_404_when_not_found(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    with pytest.raises(NotFoundError):
        await update_spec(
            db_session,
            company_id=company.id,
            user_id=user.id,
            spec_id=uuid.uuid4(),
            payload=SpecUpdate(name="X"),
        )


async def test_update_spec_404_when_other_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_b = await create_user(db_session, company_id=company_b.id)
    spec = await create_product_spec(db_session, company_id=company_a.id)
    with pytest.raises(NotFoundError):
        await update_spec(
            db_session,
            company_id=company_b.id,
            user_id=user_b.id,
            spec_id=spec.id,
            payload=SpecUpdate(name="X"),
        )


async def test_update_spec_409_on_duplicate_code(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    await create_product_spec(db_session, company_id=company.id, code="A1")
    second = await create_product_spec(db_session, company_id=company.id, code="A2")
    with pytest.raises(ConflictError):
        await update_spec(
            db_session,
            company_id=company.id,
            user_id=user.id,
            spec_id=second.id,
            payload=SpecUpdate(code="A1"),
        )


async def test_update_spec_writes_audit_log(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="AUD-1")
    await update_spec(
        db_session,
        company_id=company.id,
        user_id=user.id,
        spec_id=spec.id,
        payload=SpecUpdate(name="New name"),
    )
    audit = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == spec.id))).all()
    assert any("Updated spec AUD-1" in entry.message for entry in audit)


# ------------------------------------------------------------------ delete


async def test_delete_spec_cascades_to_trims(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    await create_spec_trim(db_session, spec_id=spec.id, trim_type=TrimType.LABEL)

    await delete_spec(db_session, company_id=company.id, user_id=user.id, spec_id=spec.id)

    remaining_trims = (await db_session.exec(select(SpecTrim).where(SpecTrim.spec_id == spec.id))).all()
    assert remaining_trims == []
    remaining_specs = (await db_session.exec(select(ProductSpec).where(ProductSpec.id == spec.id))).all()
    assert remaining_specs == []


async def test_delete_spec_blocked_when_product_links_to_it(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    await create_product(db_session, company_id=company.id, spec_id=spec.id, name="P1")

    with pytest.raises(ConflictError):
        await delete_spec(db_session, company_id=company.id, user_id=user.id, spec_id=spec.id)


async def test_delete_spec_404_when_missing(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    with pytest.raises(NotFoundError):
        await delete_spec(
            db_session,
            company_id=company.id,
            user_id=user.id,
            spec_id=uuid.uuid4(),
        )


async def test_delete_spec_404_when_other_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_b = await create_user(db_session, company_id=company_b.id)
    spec = await create_product_spec(db_session, company_id=company_a.id)
    with pytest.raises(NotFoundError):
        await delete_spec(db_session, company_id=company_b.id, user_id=user_b.id, spec_id=spec.id)


async def test_delete_spec_writes_audit_log(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="DEL-1")
    await delete_spec(db_session, company_id=company.id, user_id=user.id, spec_id=spec.id)
    audit = (await db_session.exec(select(AuditLog).where(AuditLog.resource_type == "specs"))).all()
    assert any("Deleted spec DEL-1" in entry.message for entry in audit)
