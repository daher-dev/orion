"""Unit tests for ``services.audit_log``.

Covers sort order, every filter dimension (text search, resource type,
user id, date bounds), tenant isolation, pagination, and the joined user
projection (including the ``user is None`` branch for system events or
deleted authors).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from models import AuditLog
from schemas._common import PageParams
from schemas.audit_log import AuditLogFilters
from services._audit import write_audit
from services.audit_log import list_audit_logs
from tests.factories import create_company, create_user


async def _make_entry(
    db_session,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
    resource_type: str = "clients",
    resource_id: uuid.UUID | None = None,
    message: str = "Created client X",
    created_at: datetime | None = None,
) -> AuditLog:
    """Insert an audit entry through ``write_audit`` and (optionally) backdate it."""

    entry = await write_audit(
        db_session,
        company_id=company_id,
        user_id=user_id,
        resource_type=resource_type,
        resource_id=resource_id or uuid.uuid4(),
        message=message,
    )
    if created_at is not None:
        entry.created_at = created_at
        db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


async def test_list_returns_only_tenant_rows(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    await _make_entry(db_session, company_id=company_a.id, message="A1")
    await _make_entry(db_session, company_id=company_a.id, message="A2")
    await _make_entry(db_session, company_id=company_b.id, message="B1")

    rows, total = await list_audit_logs(db_session, company_a.id, AuditLogFilters(), PageParams())
    assert total == 2
    assert {r.audit.message for r in rows} == {"A1", "A2"}


async def test_list_orders_newest_first(db_session):
    company = await create_company(db_session)
    base = datetime.now(UTC)
    await _make_entry(db_session, company_id=company.id, message="oldest", created_at=base - timedelta(hours=3))
    await _make_entry(db_session, company_id=company.id, message="middle", created_at=base - timedelta(hours=2))
    await _make_entry(db_session, company_id=company.id, message="newest", created_at=base - timedelta(hours=1))

    rows, total = await list_audit_logs(db_session, company.id, AuditLogFilters(), PageParams())
    assert total == 3
    assert [r.audit.message for r in rows] == ["newest", "middle", "oldest"]


async def test_list_joins_user_when_present(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, name="Joana Pires")
    await _make_entry(db_session, company_id=company.id, user_id=user.id, message="Created client")

    rows, total = await list_audit_logs(db_session, company.id, AuditLogFilters(), PageParams())
    assert total == 1
    assert rows[0].user is not None
    assert rows[0].user.name == "Joana Pires"


async def test_list_returns_null_user_for_system_event(db_session):
    company = await create_company(db_session)
    await _make_entry(db_session, company_id=company.id, user_id=None, message="System imported orders")

    rows, total = await list_audit_logs(db_session, company.id, AuditLogFilters(), PageParams())
    assert total == 1
    assert rows[0].user is None


async def test_list_returns_null_user_when_author_deleted(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    await _make_entry(db_session, company_id=company.id, user_id=user.id, message="Edited spec")
    # Simulate the SET NULL cascade — after the author is deleted, the
    # audit row's user_id is wiped but the entry itself persists.
    await db_session.delete(user)
    await db_session.commit()

    rows, total = await list_audit_logs(db_session, company.id, AuditLogFilters(), PageParams())
    assert total == 1
    assert rows[0].user is None
    assert rows[0].audit.message == "Edited spec"


async def test_list_filters_by_q_in_message(db_session):
    company = await create_company(db_session)
    await _make_entry(db_session, company_id=company.id, message="Created client Mariana Costa")
    await _make_entry(db_session, company_id=company.id, message="Created client Felipe Andrade")
    await _make_entry(db_session, company_id=company.id, message="Updated spec FT-014")

    rows, total = await list_audit_logs(
        db_session,
        company.id,
        AuditLogFilters(q="Mariana"),
        PageParams(),
    )
    assert total == 1
    assert rows[0].audit.message == "Created client Mariana Costa"


async def test_list_filters_by_q_in_resource_type_case_insensitive(db_session):
    company = await create_company(db_session)
    await _make_entry(db_session, company_id=company.id, resource_type="orders", message="x")
    await _make_entry(db_session, company_id=company.id, resource_type="clients", message="y")

    rows, total = await list_audit_logs(
        db_session,
        company.id,
        AuditLogFilters(q="ORDER"),
        PageParams(),
    )
    assert total == 1
    assert rows[0].audit.resource_type == "orders"


async def test_list_filters_by_resource_type(db_session):
    company = await create_company(db_session)
    await _make_entry(db_session, company_id=company.id, resource_type="orders")
    await _make_entry(db_session, company_id=company.id, resource_type="clients")
    await _make_entry(db_session, company_id=company.id, resource_type="orders")

    rows, total = await list_audit_logs(
        db_session,
        company.id,
        AuditLogFilters(resource_type="orders"),
        PageParams(),
    )
    assert total == 2
    assert {r.audit.resource_type for r in rows} == {"orders"}


async def test_list_filters_by_user_id(db_session):
    company = await create_company(db_session)
    alice = await create_user(db_session, company_id=company.id, name="Alice")
    bob = await create_user(db_session, company_id=company.id, name="Bob")
    await _make_entry(db_session, company_id=company.id, user_id=alice.id, message="alice-1")
    await _make_entry(db_session, company_id=company.id, user_id=alice.id, message="alice-2")
    await _make_entry(db_session, company_id=company.id, user_id=bob.id, message="bob-1")

    rows, total = await list_audit_logs(
        db_session,
        company.id,
        AuditLogFilters(user_id=alice.id),
        PageParams(),
    )
    assert total == 2
    assert all(r.user is not None and r.user.name == "Alice" for r in rows)


async def test_list_filters_by_date_range(db_session):
    company = await create_company(db_session)
    base = datetime.now(UTC)
    await _make_entry(db_session, company_id=company.id, message="old", created_at=base - timedelta(days=5))
    await _make_entry(db_session, company_id=company.id, message="mid", created_at=base - timedelta(days=2))
    await _make_entry(db_session, company_id=company.id, message="new", created_at=base - timedelta(hours=1))

    rows, total = await list_audit_logs(
        db_session,
        company.id,
        AuditLogFilters(date_from=base - timedelta(days=3)),
        PageParams(),
    )
    assert total == 2
    assert {r.audit.message for r in rows} == {"mid", "new"}

    rows, total = await list_audit_logs(
        db_session,
        company.id,
        AuditLogFilters(date_to=base - timedelta(days=3)),
        PageParams(),
    )
    assert total == 1
    assert rows[0].audit.message == "old"

    rows, total = await list_audit_logs(
        db_session,
        company.id,
        AuditLogFilters(
            date_from=base - timedelta(days=4),
            date_to=base - timedelta(days=1),
        ),
        PageParams(),
    )
    assert total == 1
    assert rows[0].audit.message == "mid"


async def test_list_paginates(db_session):
    company = await create_company(db_session)
    base = datetime.now(UTC)
    for i in range(7):
        await _make_entry(
            db_session,
            company_id=company.id,
            message=f"entry-{i}",
            created_at=base - timedelta(minutes=i),
        )

    rows, total = await list_audit_logs(
        db_session,
        company.id,
        AuditLogFilters(),
        PageParams(page=1, page_size=3),
    )
    assert total == 7
    assert len(rows) == 3
    # Newest first → entry-0, entry-1, entry-2
    assert [r.audit.message for r in rows] == ["entry-0", "entry-1", "entry-2"]

    rows_p3, _ = await list_audit_logs(
        db_session,
        company.id,
        AuditLogFilters(),
        PageParams(page=3, page_size=3),
    )
    assert len(rows_p3) == 1
    assert rows_p3[0].audit.message == "entry-6"


async def test_list_empty_when_no_entries(db_session):
    company = await create_company(db_session)
    rows, total = await list_audit_logs(db_session, company.id, AuditLogFilters(), PageParams())
    assert rows == []
    assert total == 0


async def test_list_filter_combines_q_and_resource_type(db_session):
    company = await create_company(db_session)
    await _make_entry(db_session, company_id=company.id, resource_type="orders", message="Mariana paid")
    await _make_entry(db_session, company_id=company.id, resource_type="clients", message="Mariana created")
    await _make_entry(db_session, company_id=company.id, resource_type="orders", message="Felipe paid")

    rows, total = await list_audit_logs(
        db_session,
        company.id,
        AuditLogFilters(q="mariana", resource_type="orders"),
        PageParams(),
    )
    assert total == 1
    assert rows[0].audit.message == "Mariana paid"
