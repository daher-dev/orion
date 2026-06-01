from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlmodel import select

from models import Invite, User
from tests.factories import (
    create_company,
    create_invite,
    create_user,
    get_admin_role,
    get_role_by_code,
)

# ---------- /v1/auth/me ----------


async def test_me_returns_empty_envelope_for_unprovisioned_user(authed_client: AsyncClient):
    response = await authed_client.get("/v1/auth/me")
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "user": None,
        "company": None,
        "role": None,
        "permissions": [],
        "companies": [],
    }


async def test_me_returns_active_membership(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")

    response = await authed_client.get("/v1/auth/me")
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["id"] == str(user.id)
    assert body["company"]["id"] == str(company.id)
    assert body["role"]["code"] == "admin"
    assert "orders.write" in body["permissions"]
    assert len(body["companies"]) == 1


async def test_me_uses_company_header_to_pick_active(authed_client: AsyncClient, db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    await create_user(db_session, company_id=company_a.id, firebase_uid="qa-dev-user")
    user_b = await create_user(db_session, company_id=company_b.id, firebase_uid="qa-dev-user")

    response = await authed_client.get(
        "/v1/auth/me",
        headers={"X-Orion-Company-Id": str(company_b.id)},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["id"] == str(user_b.id)
    assert body["company"]["id"] == str(company_b.id)
    assert len(body["companies"]) == 2


async def test_me_with_unknown_company_header_returns_companies_list_only(
    authed_client: AsyncClient,
    db_session,
):
    import uuid

    company_a = await create_company(db_session)
    await create_user(db_session, company_id=company_a.id, firebase_uid="qa-dev-user")

    response = await authed_client.get(
        "/v1/auth/me",
        headers={"X-Orion-Company-Id": str(uuid.uuid4())},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"] is None
    assert body["company"] is None
    assert len(body["companies"]) == 1


# ---------- POST /v1/auth/session (login gate) ----------


async def test_session_returns_membership_for_existing_user(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")

    response = await authed_client.post("/v1/auth/session")
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["id"] == str(user.id)
    assert body["company"]["id"] == str(company.id)


async def test_session_auto_provisions_from_pending_invite(authed_client: AsyncClient, db_session):
    # The dev-bypass identity (qa-dev-user / qa-dev@orion.local) has no membership
    # yet, but a pending invite for that email exists → it must be provisioned.
    company = await create_company(db_session)
    inviter = await create_user(db_session, company_id=company.id)
    role = await get_role_by_code(db_session, "manager")
    invite = await create_invite(
        db_session,
        company_id=company.id,
        role_id=role.id,
        email="qa-dev@orion.local",
        invited_by_id=inviter.id,
    )

    response = await authed_client.post("/v1/auth/session")
    assert response.status_code == 200
    body = response.json()
    assert body["company"]["id"] == str(company.id)
    assert body["role"]["code"] == "manager"

    user = (await db_session.exec(select(User).where(User.firebase_uid == "qa-dev-user"))).first()
    assert user is not None
    refreshed = (await db_session.exec(select(Invite).where(Invite.id == invite.id))).first()
    assert refreshed is not None
    assert refreshed.accepted_at is not None
    assert refreshed.accepted_by_id == user.id


async def test_session_rejects_uninvited_user(authed_client: AsyncClient):
    response = await authed_client.post("/v1/auth/session")
    assert response.status_code == 403
    assert response.json()["detail"] == "not_invited"


# ---------- GET /v1/auth/login-attempts ----------


async def test_login_attempts_lists_denied_attempt(authed_client: AsyncClient, db_session):
    # qa-dev-user must be an admin to read the log...
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")

    # ...and a separate uninvited identity gets denied, leaving a logged attempt.
    denied = await async_client_post_session_as(authed_client, uid="intruder", email="intruder@example.com")
    assert denied == 403

    response = await authed_client.get("/v1/auth/login-attempts?email=intruder@example.com")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["outcome"] == "not_invited"
    assert body["items"][0]["email"] == "intruder@example.com"


async def test_login_attempts_requires_users_read(authed_client: AsyncClient, db_session):
    # Operator role lacks users.read → 403.
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    await create_user(
        db_session,
        company_id=company.id,
        role_id=operator_role.id,
        firebase_uid="qa-dev-user",
    )
    response = await authed_client.get("/v1/auth/login-attempts")
    assert response.status_code == 403


async def async_client_post_session_as(authed_client: AsyncClient, *, uid: str, email: str) -> int:
    """Hit POST /v1/auth/session as a different dev-bypass identity; return status."""
    resp = await authed_client.post(
        "/v1/auth/session",
        headers={
            "X-Dev-Bypass-Uid": uid,
            "X-Dev-Bypass-Email": email,
            "X-Dev-Bypass-Name": uid,
        },
    )
    return resp.status_code


# ---------- /v1/auth/invites ----------


async def test_create_invite_requires_permission(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    await create_user(
        db_session,
        company_id=company.id,
        role_id=operator_role.id,
        firebase_uid="qa-dev-user",
    )
    role = await get_admin_role(db_session)

    response = await authed_client.post(
        "/v1/auth/invites",
        json={"email": "x@example.com", "role_id": str(role.id)},
    )
    assert response.status_code == 403


async def test_create_invite_succeeds_for_admin(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    role = await get_admin_role(db_session)
    await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )

    response = await authed_client.post(
        "/v1/auth/invites",
        json={"email": "new@example.com", "role_id": str(role.id), "expires_in_hours": 48},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new@example.com"
    assert body["token"]


# ---------- GET/POST /v1/auth/invites/{token} ----------


async def test_get_invite_public(async_client: AsyncClient, db_session):
    company = await create_company(db_session, name="Acme")
    role = await get_role_by_code(db_session, "manager")
    invite = await create_invite(db_session, company_id=company.id, role_id=role.id)

    response = await async_client.get(f"/v1/auth/invites/{invite.token}")
    assert response.status_code == 200
    body = response.json()
    assert body["company_name"] == "Acme"
    assert body["role_name"] == role.name
    assert body["email"] == invite.email


async def test_get_invite_public_404_unknown(async_client: AsyncClient):
    response = await async_client.get("/v1/auth/invites/does-not-exist")
    assert response.status_code == 404


async def test_get_invite_public_404_expired(async_client: AsyncClient, db_session):
    company = await create_company(db_session)
    role = await get_admin_role(db_session)
    expired = await create_invite(
        db_session,
        company_id=company.id,
        role_id=role.id,
        expires_at=datetime.now(UTC) - timedelta(hours=1),
    )
    response = await async_client.get(f"/v1/auth/invites/{expired.token}")
    assert response.status_code == 404


async def test_accept_invite(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    role = await get_role_by_code(db_session, "manager")
    invite = await create_invite(db_session, company_id=company.id, role_id=role.id)

    response = await authed_client.post(
        f"/v1/auth/invites/{invite.token}/accept",
        json={"name": "New Member"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["company"]["id"] == str(company.id)
    assert body["role"]["code"] == "manager"

    refreshed = (await db_session.exec(select(Invite).where(Invite.id == invite.id))).first()
    assert refreshed is not None
    assert refreshed.accepted_at is not None


async def test_accept_invite_404_invalid(authed_client: AsyncClient):
    response = await authed_client.post(
        "/v1/auth/invites/missing/accept",
        json={},
    )
    assert response.status_code == 404


# ---------- POST /v1/auth/companies/{id}/switch ----------


async def test_switch_company_requires_membership(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    other = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")

    response = await authed_client.post(f"/v1/auth/companies/{other.id}/switch")
    assert response.status_code == 403


async def test_switch_company_204_when_member(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    target = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    await create_user(db_session, company_id=target.id, firebase_uid="qa-dev-user")

    response = await authed_client.post(f"/v1/auth/companies/{target.id}/switch")
    assert response.status_code == 204


@pytest.mark.parametrize("path", ["/v1/auth/me", "/v1/auth/session", "/v1/auth/invites"])
async def test_protected_endpoints_reject_anonymous(async_client: AsyncClient, path):
    response = await async_client.get(path) if path == "/v1/auth/me" else await async_client.post(path, json={})
    assert response.status_code == 401
