import uuid

from httpx import AsyncClient

from tests.factories import (
    create_company,
    create_user,
    get_role_by_code,
)
from tests.factories import (
    create_invite as factory_create_invite,
)


async def _provision(db_session, role_code: str = "admin"):
    company = await create_company(db_session)
    role = await get_role_by_code(db_session, role_code)
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )
    return company, user, role


# ---------- GET /v1/invites ----------


async def test_list_invites_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/invites")
    assert response.status_code == 401


async def test_list_invites_returns_tenant_invites(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    await factory_create_invite(db_session, company_id=company.id, role_id=admin_role.id, email="me@x.test")
    other = await create_company(db_session)
    await factory_create_invite(db_session, company_id=other.id, role_id=admin_role.id, email="other@x.test")

    response = await authed_client.get("/v1/invites")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["email"] == "me@x.test"
    assert body["items"][0]["role"]["code"] == "admin"


async def test_list_invites_403_for_operator(authed_client: AsyncClient, db_session):
    await _provision(db_session, role_code="operator")
    response = await authed_client.get("/v1/invites")
    assert response.status_code == 403


# ---------- POST /v1/invites ----------


async def test_create_invite_201(authed_client: AsyncClient, db_session):
    _, _, _ = await _provision(db_session)
    manager_role = await get_role_by_code(db_session, "manager")
    response = await authed_client.post(
        "/v1/invites",
        json={"email": "new@example.com", "role_id": str(manager_role.id), "expires_in_hours": 72},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new@example.com"
    assert body["role"]["code"] == "manager"
    assert body["token"]
    assert body["invited_by"] is not None


async def test_create_invite_409_duplicate(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    await factory_create_invite(
        db_session,
        company_id=company.id,
        role_id=admin_role.id,
        email="dup@example.com",
    )
    response = await authed_client.post(
        "/v1/invites",
        json={"email": "dup@example.com", "role_id": str(admin_role.id)},
    )
    assert response.status_code == 409


async def test_create_invite_403_for_manager(authed_client: AsyncClient, db_session):
    await _provision(db_session, role_code="manager")
    admin_role = await get_role_by_code(db_session, "admin")
    response = await authed_client.post(
        "/v1/invites",
        json={"email": "denied@example.com", "role_id": str(admin_role.id)},
    )
    assert response.status_code == 403


async def test_create_invite_422_bad_email(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    response = await authed_client.post(
        "/v1/invites",
        json={"email": "not-an-email", "role_id": str(admin_role.id)},
    )
    assert response.status_code == 422


async def test_create_invite_404_when_role_missing(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    response = await authed_client.post(
        "/v1/invites",
        json={"email": "good@example.com", "role_id": str(uuid.uuid4())},
    )
    assert response.status_code == 404


# ---------- DELETE /v1/invites/{id} ----------


async def test_revoke_invite_204(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    invite = await factory_create_invite(
        db_session,
        company_id=company.id,
        role_id=admin_role.id,
        email="rev@x.test",
    )
    response = await authed_client.delete(f"/v1/invites/{invite.id}")
    assert response.status_code == 204


async def test_revoke_invite_404_when_missing(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    response = await authed_client.delete(f"/v1/invites/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_revoke_invite_403_for_manager(authed_client: AsyncClient, db_session):
    company, _, _ = await _provision(db_session, role_code="manager")
    admin_role = await get_role_by_code(db_session, "admin")
    invite = await factory_create_invite(
        db_session,
        company_id=company.id,
        role_id=admin_role.id,
    )
    response = await authed_client.delete(f"/v1/invites/{invite.id}")
    assert response.status_code == 403


async def test_revoke_invite_404_across_tenants(authed_client: AsyncClient, db_session):
    await _provision(db_session)
    other = await create_company(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    other_invite = await factory_create_invite(
        db_session,
        company_id=other.id,
        role_id=admin_role.id,
    )
    response = await authed_client.delete(f"/v1/invites/{other_invite.id}")
    assert response.status_code == 404


async def test_revoke_invite_409_when_accepted(authed_client: AsyncClient, db_session):
    from datetime import UTC, datetime

    company, _, _ = await _provision(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    invite = await factory_create_invite(
        db_session,
        company_id=company.id,
        role_id=admin_role.id,
    )
    invite.accepted_at = datetime.now(UTC)
    db_session.add(invite)
    await db_session.commit()

    response = await authed_client.delete(f"/v1/invites/{invite.id}")
    assert response.status_code == 409
