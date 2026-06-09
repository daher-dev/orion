"""Service-layer tests for the configurable stock-alert threshold."""

from sqlmodel import select

from models import AuditLog
from services.stock_settings import get_threshold, set_threshold
from tests.factories import create_company, create_user


async def test_get_threshold_returns_default(db_session):
    company = await create_company(db_session)
    threshold = await get_threshold(db_session, company_id=company.id)
    assert threshold == 10


async def test_get_threshold_returns_configured_value(db_session):
    company = await create_company(db_session, low_stock_threshold=3)
    threshold = await get_threshold(db_session, company_id=company.id)
    assert threshold == 3


async def test_set_threshold_persists(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    result = await set_threshold(
        db_session,
        company_id=company.id,
        user_id=user.id,
        threshold=25,
    )
    assert result == 25
    assert await get_threshold(db_session, company_id=company.id) == 25


async def test_set_threshold_clamps_negative_to_zero(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    result = await set_threshold(
        db_session,
        company_id=company.id,
        user_id=user.id,
        threshold=-5,
    )
    assert result == 0


async def test_set_threshold_writes_audit(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    await set_threshold(db_session, company_id=company.id, user_id=user.id, threshold=7)

    rows = (
        await db_session.exec(
            select(AuditLog).where(AuditLog.company_id == company.id, AuditLog.resource_type == "companies")
        )
    ).all()
    assert len(rows) == 1
    assert rows[0].user_id == user.id
    assert "7" in rows[0].message


async def test_set_threshold_tenant_isolation(db_session):
    company_a = await create_company(db_session, low_stock_threshold=10)
    company_b = await create_company(db_session, low_stock_threshold=10)
    user_a = await create_user(db_session, company_id=company_a.id)

    await set_threshold(db_session, company_id=company_a.id, user_id=user_a.id, threshold=2)

    assert await get_threshold(db_session, company_id=company_a.id) == 2
    assert await get_threshold(db_session, company_id=company_b.id) == 10
