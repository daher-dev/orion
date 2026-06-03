from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import select

from models import Invite, LoginOutcome, User
from schemas.auth import InviteCreate
from services.auth import (
    accept_invite,
    create_invite,
    establish_session,
    get_invite_by_token,
    get_user_companies,
    get_user_in_company,
)
from shared.exceptions import AuthorizationError, ConflictError, NotFoundError, ValidationError
from tests.factories import create_company, create_user, get_admin_role, get_role_by_code


def _claims(uid: str, **extra) -> dict:
    return {
        "uid": uid,
        "name": extra.get("name", "User"),
        "email": extra.get("email", f"{uid}@orion.test"),
        "email_verified": extra.get("email_verified", True),
    }


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


async def test_establish_session_returns_existing_memberships(db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="member-uid")

    memberships = await establish_session(db_session, claims=_claims("member-uid"))
    assert len(memberships) == 1
    _, company_out, role_out = memberships[0]
    assert company_out.id == company.id
    assert role_out.code == "admin"


async def test_establish_session_provisions_from_pending_invite(db_session):
    company = await create_company(db_session)
    inviter = await create_user(db_session, company_id=company.id)
    role = await get_role_by_code(db_session, "manager")
    invite = await create_invite(
        db_session,
        company_id=company.id,
        invited_by_id=inviter.id,
        payload=InviteCreate(email="hire@example.com", role_id=role.id),
    )

    memberships = await establish_session(
        db_session,
        claims=_claims("new-uid", email="hire@example.com"),
    )
    assert len(memberships) == 1
    user, _, role_out = memberships[0]
    assert user.firebase_uid == "new-uid"
    assert role_out.id == role.id

    refreshed = (await db_session.exec(select(Invite).where(Invite.id == invite.id))).first()
    assert refreshed is not None
    assert refreshed.accepted_at is not None


async def test_establish_session_rejects_uninvited(db_session):
    with pytest.raises(AuthorizationError):
        await establish_session(db_session, claims=_claims("ghost-uid", email="ghost@example.com"))


async def test_establish_session_rejects_unverified_email(db_session):
    company = await create_company(db_session)
    inviter = await create_user(db_session, company_id=company.id)
    role = await get_role_by_code(db_session, "manager")
    await create_invite(
        db_session,
        company_id=company.id,
        invited_by_id=inviter.id,
        payload=InviteCreate(email="unverified@example.com", role_id=role.id),
    )

    with pytest.raises(AuthorizationError):
        await establish_session(
            db_session,
            claims=_claims("uv-uid", email="unverified@example.com", email_verified=False),
        )


# ---------- login-attempt logging ----------


async def _attempts(db_session, email: str | None = None):
    from services.auth import list_login_attempts

    rows, total = await list_login_attempts(db_session, email=email)
    return rows, total


async def test_login_attempt_recorded_on_success(db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="member-uid", email="m@example.com")

    await establish_session(db_session, claims=_claims("member-uid", email="m@example.com"))

    rows, total = await _attempts(db_session, email="m@example.com")
    assert total == 1
    assert rows[0].outcome == LoginOutcome.SUCCESS
    assert rows[0].company_id == company.id
    assert rows[0].firebase_uid == "member-uid"


async def test_login_attempt_recorded_and_persists_on_not_invited(db_session):
    # The gate raises 403, but the attempt row must still be committed.
    with pytest.raises(AuthorizationError):
        await establish_session(db_session, claims=_claims("ghost", email="ghost@example.com"))

    rows, total = await _attempts(db_session, email="ghost@example.com")
    assert total == 1
    assert rows[0].outcome == LoginOutcome.NOT_INVITED
    assert rows[0].email == "ghost@example.com"


async def test_login_attempt_distinguishes_unverified_email(db_session):
    company = await create_company(db_session)
    inviter = await create_user(db_session, company_id=company.id)
    role = await get_role_by_code(db_session, "manager")
    await create_invite(
        db_session,
        company_id=company.id,
        invited_by_id=inviter.id,
        payload=InviteCreate(email="pending@example.com", role_id=role.id),
    )

    # Matching invite exists, but the email is unverified → distinct outcome.
    with pytest.raises(AuthorizationError):
        await establish_session(
            db_session,
            claims=_claims("uv2", email="pending@example.com", email_verified=False),
        )

    rows, _ = await _attempts(db_session, email="pending@example.com")
    assert rows[0].outcome == LoginOutcome.UNVERIFIED_EMAIL


async def test_login_attempt_recorded_on_missing_uid(db_session):
    with pytest.raises(ValidationError):
        await establish_session(db_session, claims={"email": "nouid@example.com", "email_verified": True})

    rows, _ = await _attempts(db_session, email="nouid@example.com")
    assert rows[0].outcome == LoginOutcome.MISSING_UID
    assert rows[0].firebase_uid is None


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


# ---------- imported-user rebind (base44 migration) ----------


async def test_establish_session_rebinds_imported_user(db_session):
    # The base44 importer pre-creates users with a placeholder uid + a pending
    # invite. On first real login the existing row must be rebound, not
    # duplicated (which would hit the (company_id, email) unique constraint).
    company = await create_company(db_session)
    role = await get_role_by_code(db_session, "manager")
    imported = await create_user(
        db_session,
        company_id=company.id,
        firebase_uid="base44:legacy-7",
        email="hire@example.com",
        role_id=role.id,
    )
    inviter = await create_user(db_session, company_id=company.id)
    await create_invite(
        db_session,
        company_id=company.id,
        invited_by_id=inviter.id,
        payload=InviteCreate(email="hire@example.com", role_id=role.id),
    )

    memberships = await establish_session(db_session, claims=_claims("real-uid", email="hire@example.com"))
    assert len(memberships) == 1
    user, _, _ = memberships[0]
    assert user.id == imported.id  # same row, rebound
    assert user.firebase_uid == "real-uid"

    rows = (await db_session.exec(select(User).where(User.email == "hire@example.com"))).all()
    assert len(rows) == 1  # no duplicate


async def test_accept_invite_rebinds_imported_user(db_session):
    company = await create_company(db_session)
    role = await get_role_by_code(db_session, "manager")
    imported = await create_user(
        db_session,
        company_id=company.id,
        firebase_uid="base44:legacy-9",
        email="claim@example.com",
        role_id=role.id,
    )
    inviter = await create_user(db_session, company_id=company.id)
    invite = await create_invite(
        db_session,
        company_id=company.id,
        invited_by_id=inviter.id,
        payload=InviteCreate(email="claim@example.com", role_id=role.id),
    )

    _, user, _ = await accept_invite(
        db_session,
        claims=_claims("claimer-uid", email="claim@example.com"),
        token=invite.token,
    )
    assert user.id == imported.id
    assert user.firebase_uid == "claimer-uid"

    rows = (await db_session.exec(select(User).where(User.email == "claim@example.com"))).all()
    assert len(rows) == 1
    refreshed = (await db_session.exec(select(Invite).where(Invite.id == invite.id))).first()
    assert refreshed is not None
    assert refreshed.accepted_by_id == imported.id
