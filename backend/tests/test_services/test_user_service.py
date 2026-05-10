import uuid

import pytest
from sqlmodel import select

from models import AuditLog
from schemas.user import UserUpdate
from services.user import update_user_self
from shared.exceptions import NotFoundError
from tests.factories import create_company, create_user


async def _setup(db_session, **user_kwargs):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, **user_kwargs)
    return company, user


async def test_update_user_self_changes_name_and_job_and_audits(db_session):
    company, user = await _setup(db_session, name="Old Name", job=None)

    updated = await update_user_self(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=UserUpdate(name="New Name", job="Designer"),
    )
    assert updated.name == "New Name"
    assert updated.job == "Designer"

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == user.id))).all()
    assert any("Updated profile for" in entry.message for entry in audits)


async def test_update_user_self_clears_job_when_empty_string(db_session):
    company, user = await _setup(db_session, name="Same", job="Old Job")

    updated = await update_user_self(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=UserUpdate(job=""),
    )
    assert updated.job is None


async def test_update_user_self_partial_keeps_name(db_session):
    company, user = await _setup(db_session, name="Keep Me", job=None)

    updated = await update_user_self(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=UserUpdate(job="Costureira"),
    )
    assert updated.name == "Keep Me"
    assert updated.job == "Costureira"


async def test_update_user_self_raises_when_user_missing(db_session):
    company = await create_company(db_session)

    with pytest.raises(NotFoundError):
        await update_user_self(
            db_session,
            company_id=company.id,
            user_id=uuid.uuid4(),
            payload=UserUpdate(name="x"),
        )


async def test_update_user_self_is_tenant_scoped(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_b = await create_user(db_session, company_id=company_b.id, name="B-user")

    # Calling with company_a's id but user_b.id should fail since the
    # User row lives in company_b.
    with pytest.raises(NotFoundError):
        await update_user_self(
            db_session,
            company_id=company_a.id,
            user_id=user_b.id,
            payload=UserUpdate(name="Hacked"),
        )


def test_user_update_max_length_enforced_by_schema():
    from pydantic import ValidationError as PydanticError

    with pytest.raises(PydanticError):
        UserUpdate(name="x" * 121)
    with pytest.raises(PydanticError):
        UserUpdate(job="x" * 121)
