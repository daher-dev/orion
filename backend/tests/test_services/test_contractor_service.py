import uuid

import pytest
from sqlmodel import select

from models import AuditLog, SewingContractor
from schemas._common import PageParams
from schemas.contractor import ContractorCreate, ContractorFilters, ContractorUpdate
from services.contractor import (
    create_contractor,
    delete_contractor,
    get_contractor,
    list_contractors,
    update_contractor,
)
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import create_company, create_sewing_contractor, create_user


async def _setup(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    return company, user


async def _audits_for(db_session, *, resource_id: uuid.UUID) -> list[AuditLog]:
    result = await db_session.exec(
        select(AuditLog).where(AuditLog.resource_id == resource_id, AuditLog.resource_type == "contractors")
    )
    return list(result.all())


# ---------- create_contractor ----------


async def test_create_contractor_happy_path(db_session):
    company, user = await _setup(db_session)
    payload = ContractorCreate(name="Banca Esperança", address="R. das Palmas, 12", phone="11 91234-5678")

    contractor = await create_contractor(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=payload,
    )
    assert contractor.id is not None
    assert contractor.company_id == company.id
    assert contractor.name == "Banca Esperança"
    assert contractor.address == "R. das Palmas, 12"
    assert contractor.phone == "11 91234-5678"

    audits = await _audits_for(db_session, resource_id=contractor.id)
    assert any("Contractor created" in a.message for a in audits)


async def test_create_contractor_strips_whitespace(db_session):
    company, user = await _setup(db_session)
    payload = ContractorCreate(name="  Banca X  ", address="  rua Y  ", phone="  9999  ")
    contractor = await create_contractor(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=payload,
    )
    assert contractor.name == "Banca X"
    assert contractor.address == "rua Y"
    assert contractor.phone == "9999"


async def test_create_contractor_allows_optional_address_phone(db_session):
    company, user = await _setup(db_session)
    contractor = await create_contractor(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=ContractorCreate(name="Solo"),
    )
    assert contractor.address is None
    assert contractor.phone is None


async def test_create_contractor_rejects_duplicate_name(db_session):
    company, user = await _setup(db_session)
    await create_contractor(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=ContractorCreate(name="Banca Dupla"),
    )
    with pytest.raises(ConflictError):
        await create_contractor(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=ContractorCreate(name="Banca Dupla"),
        )


async def test_create_contractor_duplicate_check_is_case_insensitive(db_session):
    company, user = await _setup(db_session)
    await create_contractor(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=ContractorCreate(name="Banca CASE"),
    )
    with pytest.raises(ConflictError):
        await create_contractor(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=ContractorCreate(name="banca case"),
        )


async def test_create_contractor_same_name_allowed_across_tenants(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_a = await create_user(db_session, company_id=company_a.id)
    user_b = await create_user(db_session, company_id=company_b.id)

    contractor_a = await create_contractor(
        db_session,
        company_id=company_a.id,
        user_id=user_a.id,
        payload=ContractorCreate(name="Banca Shared"),
    )
    contractor_b = await create_contractor(
        db_session,
        company_id=company_b.id,
        user_id=user_b.id,
        payload=ContractorCreate(name="Banca Shared"),
    )
    assert contractor_a.id != contractor_b.id
    assert contractor_a.company_id == company_a.id
    assert contractor_b.company_id == company_b.id


# ---------- get_contractor ----------


async def test_get_contractor_returns_match(db_session):
    company, _ = await _setup(db_session)
    seed = await create_sewing_contractor(db_session, company_id=company.id, name="Banca Get")

    fetched = await get_contractor(db_session, company_id=company.id, contractor_id=seed.id)
    assert fetched.id == seed.id


async def test_get_contractor_not_found_when_unknown_id(db_session):
    company, _ = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await get_contractor(db_session, company_id=company.id, contractor_id=uuid.uuid4())


async def test_get_contractor_isolated_by_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    seed = await create_sewing_contractor(db_session, company_id=company_a.id, name="Tenant-A Banca")

    with pytest.raises(NotFoundError):
        await get_contractor(db_session, company_id=company_b.id, contractor_id=seed.id)


# ---------- list_contractors ----------


async def test_list_contractors_returns_paginated_result(db_session):
    company, _ = await _setup(db_session)
    for i in range(3):
        await create_sewing_contractor(db_session, company_id=company.id, name=f"Banca {i:02d}")

    items, total = await list_contractors(
        db_session,
        company_id=company.id,
        filters=ContractorFilters(),
        page=PageParams(page=1, page_size=50),
    )
    assert total == 3
    assert len(items) == 3


async def test_list_contractors_pagination_respects_page_size(db_session):
    company, _ = await _setup(db_session)
    for i in range(5):
        await create_sewing_contractor(db_session, company_id=company.id, name=f"Banca {i:02d}")

    items, total = await list_contractors(
        db_session,
        company_id=company.id,
        filters=ContractorFilters(),
        page=PageParams(page=1, page_size=2),
    )
    assert total == 5
    assert len(items) == 2


async def test_list_contractors_filters_by_name(db_session):
    company, _ = await _setup(db_session)
    await create_sewing_contractor(db_session, company_id=company.id, name="Banca Esperança")
    await create_sewing_contractor(db_session, company_id=company.id, name="Banca Dona Lúcia")

    items, total = await list_contractors(
        db_session,
        company_id=company.id,
        filters=ContractorFilters(q="esperan"),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].name == "Banca Esperança"


async def test_list_contractors_filters_by_phone(db_session):
    company, _ = await _setup(db_session)
    await create_sewing_contractor(db_session, company_id=company.id, name="A", phone="11 99999-1111")
    await create_sewing_contractor(db_session, company_id=company.id, name="B", phone="11 88888-2222")

    items, total = await list_contractors(
        db_session,
        company_id=company.id,
        filters=ContractorFilters(q="88888"),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].name == "B"


async def test_list_contractors_isolated_by_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    await create_sewing_contractor(db_session, company_id=company_a.id, name="Banca A")
    await create_sewing_contractor(db_session, company_id=company_b.id, name="Banca B")

    items, total = await list_contractors(
        db_session,
        company_id=company_a.id,
        filters=ContractorFilters(),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].name == "Banca A"


# ---------- update_contractor ----------


async def test_update_contractor_changes_fields(db_session):
    company, user = await _setup(db_session)
    seed = await create_sewing_contractor(
        db_session,
        company_id=company.id,
        name="Old Name",
        phone="111",
    )
    updated = await update_contractor(
        db_session,
        company_id=company.id,
        user_id=user.id,
        contractor_id=seed.id,
        payload=ContractorUpdate(name="New Name", phone="222", address="New Addr"),
    )
    assert updated.name == "New Name"
    assert updated.phone == "222"
    assert updated.address == "New Addr"

    audits = await _audits_for(db_session, resource_id=seed.id)
    assert any("Contractor updated" in a.message for a in audits)


async def test_update_contractor_partial_only_changes_provided(db_session):
    company, user = await _setup(db_session)
    seed = await create_sewing_contractor(
        db_session,
        company_id=company.id,
        name="Keep",
        phone="999",
        address="Untouched",
    )
    updated = await update_contractor(
        db_session,
        company_id=company.id,
        user_id=user.id,
        contractor_id=seed.id,
        payload=ContractorUpdate(phone="888"),
    )
    assert updated.name == "Keep"
    assert updated.address == "Untouched"
    assert updated.phone == "888"


async def test_update_contractor_can_clear_phone(db_session):
    company, user = await _setup(db_session)
    seed = await create_sewing_contractor(db_session, company_id=company.id, name="X", phone="9")
    updated = await update_contractor(
        db_session,
        company_id=company.id,
        user_id=user.id,
        contractor_id=seed.id,
        payload=ContractorUpdate(phone=None),
    )
    assert updated.phone is None


async def test_update_contractor_rejects_duplicate_name(db_session):
    company, user = await _setup(db_session)
    await create_sewing_contractor(db_session, company_id=company.id, name="Taken")
    seed = await create_sewing_contractor(db_session, company_id=company.id, name="Mine")

    with pytest.raises(ConflictError):
        await update_contractor(
            db_session,
            company_id=company.id,
            user_id=user.id,
            contractor_id=seed.id,
            payload=ContractorUpdate(name="Taken"),
        )


async def test_update_contractor_renaming_to_same_name_allowed(db_session):
    company, user = await _setup(db_session)
    seed = await create_sewing_contractor(db_session, company_id=company.id, name="Same")
    updated = await update_contractor(
        db_session,
        company_id=company.id,
        user_id=user.id,
        contractor_id=seed.id,
        payload=ContractorUpdate(name="Same"),
    )
    assert updated.name == "Same"


async def test_update_contractor_not_found(db_session):
    company, user = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await update_contractor(
            db_session,
            company_id=company.id,
            user_id=user.id,
            contractor_id=uuid.uuid4(),
            payload=ContractorUpdate(name="X"),
        )


# ---------- delete_contractor ----------


async def test_delete_contractor_removes_row(db_session):
    company, user = await _setup(db_session)
    seed = await create_sewing_contractor(db_session, company_id=company.id, name="To Delete")

    await delete_contractor(
        db_session,
        company_id=company.id,
        user_id=user.id,
        contractor_id=seed.id,
    )

    remaining = (await db_session.exec(select(SewingContractor).where(SewingContractor.id == seed.id))).first()
    assert remaining is None

    audits = await _audits_for(db_session, resource_id=seed.id)
    assert any("Contractor deleted" in a.message for a in audits)


async def test_delete_contractor_not_found(db_session):
    company, user = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await delete_contractor(
            db_session,
            company_id=company.id,
            user_id=user.id,
            contractor_id=uuid.uuid4(),
        )


async def test_delete_contractor_isolated_by_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_b = await create_user(db_session, company_id=company_b.id)
    seed = await create_sewing_contractor(db_session, company_id=company_a.id, name="Owned")

    with pytest.raises(NotFoundError):
        await delete_contractor(
            db_session,
            company_id=company_b.id,
            user_id=user_b.id,
            contractor_id=seed.id,
        )
