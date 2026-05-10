import uuid

from sqlmodel import select

from models import AuditLog
from services._audit import write_audit
from tests.factories import create_company, create_user


async def test_write_audit_creates_row(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    resource_id = uuid.uuid4()

    entry = await write_audit(
        db_session,
        company_id=company.id,
        user_id=user.id,
        resource_type="orders",
        resource_id=resource_id,
        message="created",
    )
    await db_session.commit()

    rows = (await db_session.exec(select(AuditLog).where(AuditLog.id == entry.id))).all()
    assert len(rows) == 1
    row = rows[0]
    assert row.company_id == company.id
    assert row.user_id == user.id
    assert row.resource_type == "orders"
    assert row.resource_id == resource_id
    assert row.message == "created"


async def test_write_audit_allows_null_user(db_session):
    company = await create_company(db_session)
    resource_id = uuid.uuid4()

    entry = await write_audit(
        db_session,
        company_id=company.id,
        user_id=None,
        resource_type="system",
        resource_id=resource_id,
        message="system event",
    )
    await db_session.commit()

    fetched = (await db_session.exec(select(AuditLog).where(AuditLog.id == entry.id))).first()
    assert fetched is not None
    assert fetched.user_id is None
