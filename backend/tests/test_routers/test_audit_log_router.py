"""HTTP-layer tests for ``routers.audit_log``.

Covers the success path (200 with paginated body), the auth / permission
matrix (401, 403), parameter validation (422), filter query strings,
and tenant isolation across the GET endpoint.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient

from services._audit import write_audit
from tests.factories import (
    create_company,
    create_user,
    get_role_by_code,
)


async def _provision_manager(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid=firebase_uid)
    return company, user


async def _provision_operator(db_session, firebase_uid: str = "qa-dev-user"):
    """Operator lacks ``users.read`` — used to exercise the 403 path."""

    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=operator_role.id,
        firebase_uid=firebase_uid,
    )
    return company, user


async def _seed_entry(
    db_session,
    *,
    company_id,
    user_id=None,
    resource_type="clients",
    message="Created client Test",
    created_at: datetime | None = None,
):
    entry = await write_audit(
        db_session,
        company_id=company_id,
        user_id=user_id,
        resource_type=resource_type,
        resource_id=uuid.uuid4(),
        message=message,
    )
    if created_at is not None:
        entry.created_at = created_at
        db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    return entry


# ---------- GET /v1/audit-logs ----------


async def test_list_audit_logs_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/audit-logs")
    assert response.status_code == 401


async def test_list_audit_logs_returns_only_tenant_rows(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    other = await create_company(db_session)
    await _seed_entry(db_session, company_id=company.id, message="Mine")
    await _seed_entry(db_session, company_id=other.id, message="Theirs")

    response = await authed_client.get("/v1/audit-logs")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["message"] == "Mine"


async def test_list_audit_logs_orders_newest_first(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    base = datetime.now(UTC)
    await _seed_entry(db_session, company_id=company.id, message="oldest", created_at=base - timedelta(hours=3))
    await _seed_entry(db_session, company_id=company.id, message="newest", created_at=base - timedelta(hours=1))

    response = await authed_client.get("/v1/audit-logs")
    assert response.status_code == 200
    body = response.json()
    assert [i["message"] for i in body["items"]] == ["newest", "oldest"]


async def test_list_audit_logs_includes_user_when_present(authed_client: AsyncClient, db_session):
    company, user = await _provision_manager(db_session)
    await _seed_entry(db_session, company_id=company.id, user_id=user.id, message="m")

    response = await authed_client.get("/v1/audit-logs")
    body = response.json()
    assert body["items"][0]["user"] is not None
    assert body["items"][0]["user"]["id"] == str(user.id)
    assert body["items"][0]["user"]["name"] == user.name


async def test_list_audit_logs_user_field_is_null_for_system_event(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    await _seed_entry(db_session, company_id=company.id, user_id=None, message="system import")

    response = await authed_client.get("/v1/audit-logs")
    body = response.json()
    assert body["items"][0]["user"] is None


async def test_list_audit_logs_filters_by_query(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    await _seed_entry(db_session, company_id=company.id, message="Mariana paid")
    await _seed_entry(db_session, company_id=company.id, message="Felipe paid")

    response = await authed_client.get("/v1/audit-logs", params={"q": "mari"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["message"] == "Mariana paid"


async def test_list_audit_logs_filters_by_resource_type(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    await _seed_entry(db_session, company_id=company.id, resource_type="orders", message="O")
    await _seed_entry(db_session, company_id=company.id, resource_type="clients", message="C")

    response = await authed_client.get("/v1/audit-logs", params={"resource_type": "clients"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["resource_type"] == "clients"


async def test_list_audit_logs_filters_by_user_id(authed_client: AsyncClient, db_session):
    company, user = await _provision_manager(db_session)
    other_user = await create_user(db_session, company_id=company.id, name="Other")
    await _seed_entry(db_session, company_id=company.id, user_id=user.id, message="mine")
    await _seed_entry(db_session, company_id=company.id, user_id=other_user.id, message="theirs")

    response = await authed_client.get("/v1/audit-logs", params={"user_id": str(user.id)})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["message"] == "mine"


async def test_list_audit_logs_filters_by_date_range(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    base = datetime.now(UTC)
    await _seed_entry(db_session, company_id=company.id, message="old", created_at=base - timedelta(days=5))
    await _seed_entry(db_session, company_id=company.id, message="recent", created_at=base - timedelta(hours=1))

    response = await authed_client.get(
        "/v1/audit-logs",
        params={"date_from": (base - timedelta(days=1)).isoformat()},
    )
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["message"] == "recent"


async def test_list_audit_logs_paginates(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    base = datetime.now(UTC)
    for i in range(4):
        await _seed_entry(
            db_session,
            company_id=company.id,
            message=f"e{i}",
            created_at=base - timedelta(minutes=i),
        )

    response = await authed_client.get("/v1/audit-logs", params={"page": 1, "page_size": 2})
    body = response.json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert body["has_more"] is True


async def test_list_audit_logs_403_for_operator(authed_client: AsyncClient, db_session):
    """Operator role lacks ``users.read`` and must be denied."""

    await _provision_operator(db_session)

    response = await authed_client.get("/v1/audit-logs")
    assert response.status_code == 403


async def test_list_audit_logs_422_when_page_invalid(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)

    response = await authed_client.get("/v1/audit-logs", params={"page": 0})
    assert response.status_code == 422


async def test_list_audit_logs_422_when_page_size_over_limit(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)

    response = await authed_client.get("/v1/audit-logs", params={"page_size": 999})
    assert response.status_code == 422


async def test_list_audit_logs_422_when_user_id_not_uuid(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)

    response = await authed_client.get("/v1/audit-logs", params={"user_id": "not-a-uuid"})
    assert response.status_code == 422


async def test_list_audit_logs_empty_response(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.get("/v1/audit-logs")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 0
    assert body["items"] == []
    assert body["has_more"] is False
