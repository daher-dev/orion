"""Tests for the AuditLog model."""

import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import AuditLog, Company, Role, User


async def _make_company_and_user(db_session: AsyncSession) -> tuple[Company, User]:
    company = Company(name="Acme Têxtil", subdomain="acme-audit", main_color="#FF6600")
    db_session.add(company)
    await db_session.flush()

    role = (await db_session.exec(select(Role).where(Role.code == "admin"))).one()
    user = User(
        company_id=company.id,
        firebase_uid="firebase-audit-1",
        name="Joao",
        email="joao@acme-audit.example",
        role_id=role.id,
    )
    db_session.add(user)
    await db_session.flush()
    return company, user


async def test_audit_log_records_user_action(db_session: AsyncSession) -> None:
    company, user = await _make_company_and_user(db_session)

    target_id = uuid.uuid4()
    log = AuditLog(
        company_id=company.id,
        user_id=user.id,
        resource_type="products",
        resource_id=target_id,
        message="Created product CAM01-FLR03-MBLK",
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)

    assert log.id is not None
    assert log.created_at is not None  # server-side timestamp
    assert log.user_id == user.id
    assert log.resource_type == "products"
    assert log.resource_id == target_id


async def test_audit_log_user_id_is_nullable_for_system_events(db_session: AsyncSession) -> None:
    company, _ = await _make_company_and_user(db_session)

    log = AuditLog(
        company_id=company.id,
        user_id=None,
        resource_type="cutting_orders",
        resource_id=uuid.uuid4(),
        message="System: status auto-advanced after timeout",
    )
    db_session.add(log)
    await db_session.commit()

    fetched = (await db_session.exec(select(AuditLog).where(AuditLog.message.like("System:%")))).one()
    assert fetched.user_id is None


async def test_audit_log_survives_user_deletion_via_set_null(db_session: AsyncSession) -> None:
    company, user = await _make_company_and_user(db_session)
    user_id = user.id
    resource_id = uuid.uuid4()

    db_session.add(
        AuditLog(
            company_id=company.id,
            user_id=user_id,
            resource_type="orders",
            resource_id=resource_id,
            message="Marked as paid",
        )
    )
    await db_session.commit()

    # Delete the user; audit row must survive with user_id set to NULL.
    await db_session.delete(user)
    await db_session.commit()

    log = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == resource_id))).one()
    assert log.user_id is None
    assert log.message == "Marked as paid"


async def test_audit_logs_query_by_resource(db_session: AsyncSession) -> None:
    company, user = await _make_company_and_user(db_session)
    resource_id = uuid.uuid4()
    other_id = uuid.uuid4()

    db_session.add_all(
        [
            AuditLog(
                company_id=company.id,
                user_id=user.id,
                resource_type="products",
                resource_id=resource_id,
                message="Created",
            ),
            AuditLog(
                company_id=company.id,
                user_id=user.id,
                resource_type="products",
                resource_id=resource_id,
                message="Renamed",
            ),
            AuditLog(
                company_id=company.id,
                user_id=user.id,
                resource_type="products",
                resource_id=other_id,
                message="Created",
            ),
        ]
    )
    await db_session.commit()

    history = (
        await db_session.exec(
            select(AuditLog)
            .where(
                AuditLog.company_id == company.id,
                AuditLog.resource_type == "products",
                AuditLog.resource_id == resource_id,
            )
            .order_by(AuditLog.created_at)
        )
    ).all()
    assert [log.message for log in history] == ["Created", "Renamed"]
