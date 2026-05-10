from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import select

from models import AuditLog, Invite, User
from schemas.auth import InviteCreate, OnboardingRequest
from services.auth import (
    accept_invite,
    create_company_and_admin,
    create_invite,
    get_invite_by_token,
    get_user_companies,
    get_user_in_company,
)
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import create_company, create_user, get_admin_role, get_role_by_code


def _claims(uid: str, **extra) -> dict:
    return {"uid": uid, "name": extra.get("name", "User"), "email": extra.get("email", f"{uid}@orion.test")}


async def test_get_user_companies_returns_memberships_in_order(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    await create_user(db_session, company_id=company_a.id, firebase_uid="multi-uid")
    await create_user(db_session, company_id=company_b.id, firebase_uid="multi-uid")

    memberships = await get_user_companies(db_session, "multi-uid")
    assert len(memberships) == 2
    assert {company.id for _, company, _ in memberships} == {company_a.id, company_b.id}
    assert all(role.code == "admin" for _, _, role in memberships)


async def test_get_user_companies_empty(db_session):
    memberships = await get_user_companies(db_session, "ghost")
    assert memberships == []


async def test_create_company_and_admin_happy_path(db_session):
    payload = OnboardingRequest(company_name="Acme", subdomain="acme")
    company, user, role = await create_company_and_admin(
        db_session,
        claims=_claims("uid-1"),
        payload=payload,
    )
    assert company.subdomain == "acme"
    assert user.firebase_uid == "uid-1"
    assert role.code == "admin"

    audit = (await db_session.exec(select(AuditLog).where(AuditLog.company_id == company.id))).all()
    assert any("Company created" in row.message for row in audit)


async def test_create_company_and_admin_rejects_duplicate_subdomain(db_session):
    payload = OnboardingRequest(company_name="Acme", subdomain="acme")
    await create_company_and_admin(db_session, claims=_claims("uid-1"), payload=payload)

    with pytest.raises(ConflictError):
        await create_company_and_admin(db_session, claims=_claims("uid-2"), payload=payload)


async def test_create_company_and_admin_rejects_reserved_subdomain(db_session):
    payload = OnboardingRequest(company_name="Acme", subdomain="www")
    with pytest.raises(ConflictError):
        await create_company_and_admin(db_session, claims=_claims("uid-1"), payload=payload)


async def test_create_invite_happy_path(db_session):
    company = await create_company(db_session)
    inviter = await create_user(db_session, company_id=company.id)
    role = await get_role_by_code(db_session, "manager")

    invite = await create_invite(
        db_session,
        company_id=company.id,
        invited_by_id=inviter.id,
        payload=InviteCreate(email="new-hire@example.com", role_id=role.id),
    )
    assert invite.token
    assert invite.email == "new-hire@example.com"
    assert invite.expires_at > datetime.now(UTC)
    assert invite.invited_by_id == inviter.id


async def test_create_invite_blocks_duplicate_pending(db_session):
    company = await create_company(db_session)
    inviter = await create_user(db_session, company_id=company.id)
    role = await get_role_by_code(db_session, "manager")
    payload = InviteCreate(email="dup@example.com", role_id=role.id)
    await create_invite(db_session, company_id=company.id, invited_by_id=inviter.id, payload=payload)
    with pytest.raises(ConflictError):
        await create_invite(db_session, company_id=company.id, invited_by_id=inviter.id, payload=payload)


async def test_create_invite_rejects_unknown_role(db_session):
    import uuid as _uuid

    company = await create_company(db_session)
    inviter = await create_user(db_session, company_id=company.id)
    payload = InviteCreate(email="x@example.com", role_id=_uuid.uuid4())
    with pytest.raises(NotFoundError):
        await create_invite(db_session, company_id=company.id, invited_by_id=inviter.id, payload=payload)


async def test_get_invite_by_token_invalid(db_session):
    with pytest.raises(NotFoundError):
        await get_invite_by_token(db_session, "nope")


async def test_get_invite_by_token_expired(db_session):
    from tests.factories import create_invite as factory_create_invite

    company = await create_company(db_session)
    role = await get_admin_role(db_session)
    expired = await factory_create_invite(
        db_session,
        company_id=company.id,
        role_id=role.id,
        expires_at=datetime.now(UTC) - timedelta(hours=1),
    )
    with pytest.raises(NotFoundError):
        await get_invite_by_token(db_session, expired.token)


async def test_accept_invite_creates_user_and_marks_invite(db_session):
    company = await create_company(db_session)
    inviter = await create_user(db_session, company_id=company.id)
    role = await get_role_by_code(db_session, "manager")
    invite = await create_invite(
        db_session,
        company_id=company.id,
        invited_by_id=inviter.id,
        payload=InviteCreate(email="hire@example.com", role_id=role.id),
    )

    company_out, user, role_out = await accept_invite(
        db_session,
        claims=_claims("uid-acc", email="hire@example.com"),
        token=invite.token,
    )
    assert company_out.id == company.id
    assert user.firebase_uid == "uid-acc"
    assert role_out.id == role.id

    refreshed = (await db_session.exec(select(Invite).where(Invite.id == invite.id))).first()
    assert refreshed is not None
    assert refreshed.accepted_at is not None
    assert refreshed.accepted_by_id == user.id


async def test_accept_invite_rejects_already_accepted(db_session):
    company = await create_company(db_session)
    inviter = await create_user(db_session, company_id=company.id)
    role = await get_role_by_code(db_session, "manager")
    invite = await create_invite(
        db_session,
        company_id=company.id,
        invited_by_id=inviter.id,
        payload=InviteCreate(email="hire@example.com", role_id=role.id),
    )
    await accept_invite(
        db_session,
        claims=_claims("uid-acc", email="hire@example.com"),
        token=invite.token,
    )
    with pytest.raises(NotFoundError):
        await accept_invite(
            db_session,
            claims=_claims("uid-acc", email="hire@example.com"),
            token=invite.token,
        )


async def test_accept_invite_reuses_existing_membership(db_session):
    company = await create_company(db_session)
    inviter = await create_user(db_session, company_id=company.id)
    role = await get_role_by_code(db_session, "manager")
    invite = await create_invite(
        db_session,
        company_id=company.id,
        invited_by_id=inviter.id,
        payload=InviteCreate(email="exist@example.com", role_id=role.id),
    )
    existing_user = await create_user(
        db_session,
        company_id=company.id,
        firebase_uid="exist-uid",
        email="exist@example.com",
    )

    _, user, _ = await accept_invite(
        db_session,
        claims=_claims("exist-uid", email="exist@example.com"),
        token=invite.token,
    )
    assert user.id == existing_user.id


async def test_get_user_in_company(db_session):
    company = await create_company(db_session)
    other = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid="me")

    found = await get_user_in_company(db_session, firebase_uid="me", company_id=company.id)
    assert found is not None
    assert found.id == user.id

    none = await get_user_in_company(db_session, firebase_uid="me", company_id=other.id)
    assert none is None
    assert isinstance(user, User)
