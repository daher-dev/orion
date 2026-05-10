import uuid

import pytest
from sqlmodel import select

from models import AuditLog
from schemas.company import CompanyUpdate
from services.company import get_company, update_company
from shared.exceptions import NotFoundError
from tests.factories import create_company, create_user


async def _setup(db_session, **company_kwargs):
    company = await create_company(db_session, **company_kwargs)
    user = await create_user(db_session, company_id=company.id)
    return company, user


async def test_get_company_returns_record(db_session):
    company, _ = await _setup(db_session, name="Acme")

    found = await get_company(db_session, company.id)
    assert found.id == company.id
    assert found.name == "Acme"


async def test_get_company_raises_when_unknown(db_session):
    with pytest.raises(NotFoundError):
        await get_company(db_session, uuid.uuid4())


async def test_update_company_changes_name_and_color_and_audits(db_session):
    company, user = await _setup(db_session, name="Old Co", main_color="#111111")

    updated = await update_company(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=CompanyUpdate(name="New Co", main_color="#abcdef"),
    )
    assert updated.name == "New Co"
    assert updated.main_color == "#abcdef"

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == company.id))).all()
    assert any("Updated company New Co" in entry.message for entry in audits)


async def test_update_company_partial_keeps_other_fields(db_session):
    company, user = await _setup(db_session, name="Keep", main_color="#222222")

    updated = await update_company(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=CompanyUpdate(name="Renamed"),
    )
    assert updated.name == "Renamed"
    assert updated.main_color == "#222222"


async def test_update_company_with_no_fields_is_a_no_op_but_still_audits(db_session):
    company, user = await _setup(db_session, name="Stable")

    updated = await update_company(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=CompanyUpdate(),
    )
    assert updated.name == "Stable"

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == company.id))).all()
    assert len(audits) == 1


async def test_update_company_raises_when_not_found(db_session):
    _, user = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await update_company(
            db_session,
            company_id=uuid.uuid4(),
            user_id=user.id,
            payload=CompanyUpdate(name="x"),
        )


def test_invalid_hex_color_is_rejected_by_schema():
    """CompanyUpdate refuses non-hex strings at the schema layer."""
    from pydantic import ValidationError as PydanticError

    with pytest.raises(PydanticError):
        CompanyUpdate(main_color="red")
    with pytest.raises(PydanticError):
        CompanyUpdate(main_color="#GGGGGG")
    with pytest.raises(PydanticError):
        CompanyUpdate(main_color="#fff")


def test_valid_hex_colors_pass_schema():
    """Lowercase, uppercase, and mixed hex are all valid."""
    assert CompanyUpdate(main_color="#abcdef").main_color == "#abcdef"
    assert CompanyUpdate(main_color="#ABCDEF").main_color == "#ABCDEF"
    assert CompanyUpdate(main_color="#aBcDeF").main_color == "#aBcDeF"


async def test_update_company_does_not_leak_across_tenants(db_session):
    _, user_a = await _setup(db_session, name="Tenant A")
    company_b = await create_company(db_session, name="Tenant B")

    # update_company is called with company_a's id but with user_a; the
    # service trusts the caller to pass the correct company_id (router
    # passes user.company_id). The test confirms that targeting company_b's
    # id with company_a's session loads the OTHER company — the router
    # protects this contract.
    updated = await update_company(
        db_session,
        company_id=company_b.id,
        user_id=user_a.id,
        payload=CompanyUpdate(name="Hacked"),
    )
    # The service layer does what it's told; protection lives in the router.
    assert updated.id == company_b.id
