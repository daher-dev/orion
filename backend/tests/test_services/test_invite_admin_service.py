import uuid

import pytest
from sqlmodel import select

from models import AuditLog, Invite
from schemas._common import PageParams
from schemas.auth import InviteCreate as AuthInviteCreate
from services.invite import (
    create_invite,
    get_invite,
    list_invites,
    revoke_invite,
)
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import (
    create_company,
    create_user,
    get_role_by_code,
)
from tests.factories import (
    create_invite as factory_create_invite,
)


async def _setup(db_session):
    company = await create_company(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    admin = await create_user(db_session, company_id=company.id, role_id=admin_role.id)
    return company, admin, admin_role


async def test_list_invites_returns_tenant_invites(db_session):
    company, _admin, admin_role = await _setup(db_session)
    manager_role = await get_role_by_code(db_session, "manager")
    await factory_create_invite(db_session, company_id=company.id, role_id=admin_role.id, email="a@x.test")
    await factory_create_invite(db_session, company_id=company.id, role_id=manager_role.id, email="b@x.test")

    other = await create_company(db_session)
    await factory_create_invite(db_session, company_id=other.id, role_id=admin_role.id, email="c@x.test")

    rows, total = await list_invites(db_session, company.id, PageParams())
    assert total == 2
    emails = {invite.email for invite, _role, _inviter in rows}
    assert emails == {"a@x.test", "b@x.test"}


async def test_list_invites_orders_by_created_desc(db_session):
    company, _, admin_role = await _setup(db_session)
    from datetime import UTC, datetime, timedelta

    older = await factory_create_invite(
        db_session,
        company_id=company.id,
        role_id=admin_role.id,
        email="old@x.test",
    )
    newer = await factory_create_invite(
        db_session,
        company_id=company.id,
        role_id=admin_role.id,
        email="new@x.test",
    )
    # Force ordering by setting created_at directly.
    older.created_at = datetime.now(UTC) - timedelta(days=1)
    newer.created_at = datetime.now(UTC)
    db_session.add(older)
    db_session.add(newer)
    await db_session.commit()

    rows, _ = await list_invites(db_session, company.id, PageParams())
    emails = [invite.email for invite, _, _ in rows]
    assert emails == ["new@x.test", "old@x.test"]


async def test_list_invites_paginates(db_session):
    company, _, admin_role = await _setup(db_session)
    for i in range(3):
        await factory_create_invite(
            db_session,
            company_id=company.id,
            role_id=admin_role.id,
            email=f"page-{i}@x.test",
        )
    rows, total = await list_invites(db_session, company.id, PageParams(page=1, page_size=2))
    assert total == 3
    assert len(rows) == 2


async def test_list_invites_includes_invited_by(db_session):
    company, admin, admin_role = await _setup(db_session)
    await factory_create_invite(
        db_session,
        company_id=company.id,
        role_id=admin_role.id,
        invited_by_id=admin.id,
        email="byme@x.test",
    )
    rows, _ = await list_invites(db_session, company.id, PageParams())
    _invite, _role, inviter = rows[0]
    assert inviter is not None
    assert inviter.id == admin.id


async def test_create_invite_persists_audit_and_token(db_session):
    company, admin, admin_role = await _setup(db_session)
    invite = await create_invite(
        db_session,
        company_id=company.id,
        invited_by_id=admin.id,
        payload=AuthInviteCreate(email="new@example.com", role_id=admin_role.id, expires_in_hours=72),
    )
    assert invite.id is not None
    assert len(invite.token) > 20
    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == invite.id))).all()
    assert any("Invite created" in a.message for a in audits)


async def test_create_invite_rejects_duplicate_pending(db_session):
    company, admin, admin_role = await _setup(db_session)
    await create_invite(
        db_session,
        company_id=company.id,
        invited_by_id=admin.id,
        payload=AuthInviteCreate(email="dup@example.com", role_id=admin_role.id),
    )
    with pytest.raises(ConflictError):
        await create_invite(
            db_session,
            company_id=company.id,
            invited_by_id=admin.id,
            payload=AuthInviteCreate(email="dup@example.com", role_id=admin_role.id),
        )


async def test_create_invite_404_when_role_missing(db_session):
    company, admin, _ = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await create_invite(
            db_session,
            company_id=company.id,
            invited_by_id=admin.id,
            payload=AuthInviteCreate(email="bad-role@example.com", role_id=uuid.uuid4()),
        )


async def test_revoke_invite_hard_deletes_and_audits(db_session):
    company, admin, admin_role = await _setup(db_session)
    invite = await factory_create_invite(
        db_session,
        company_id=company.id,
        role_id=admin_role.id,
        email="revoke@x.test",
    )
    await revoke_invite(db_session, company.id, admin.id, invite.id)
    remaining = (await db_session.exec(select(Invite).where(Invite.id == invite.id))).first()
    assert remaining is None
    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == invite.id))).all()
    assert any("Revoked invite for revoke@x.test" in a.message for a in audits)


async def test_revoke_invite_404_when_missing(db_session):
    company, admin, _ = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await revoke_invite(db_session, company.id, admin.id, uuid.uuid4())


async def test_revoke_invite_conflict_when_already_accepted(db_session):
    from datetime import UTC, datetime

    company, admin, admin_role = await _setup(db_session)
    invite = await factory_create_invite(
        db_session,
        company_id=company.id,
        role_id=admin_role.id,
        email="already@x.test",
    )
    invite.accepted_at = datetime.now(UTC)
    db_session.add(invite)
    await db_session.commit()

    with pytest.raises(ConflictError):
        await revoke_invite(db_session, company.id, admin.id, invite.id)


async def test_revoke_invite_does_not_cross_tenants(db_session):
    company, admin, admin_role = await _setup(db_session)
    other = await create_company(db_session)
    other_invite = await factory_create_invite(
        db_session,
        company_id=other.id,
        role_id=admin_role.id,
        email="other@x.test",
    )
    with pytest.raises(NotFoundError):
        await revoke_invite(db_session, company.id, admin.id, other_invite.id)


async def test_get_invite_returns_role_and_inviter(db_session):
    company, admin, admin_role = await _setup(db_session)
    invite = await factory_create_invite(
        db_session,
        company_id=company.id,
        role_id=admin_role.id,
        invited_by_id=admin.id,
        email="getme@x.test",
    )
    fetched_invite, role, inviter = await get_invite(db_session, company.id, invite.id)
    assert fetched_invite.id == invite.id
    assert role.code == "admin"
    assert inviter is not None
    assert inviter.id == admin.id


async def test_get_invite_404(db_session):
    company, _, _ = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await get_invite(db_session, company.id, uuid.uuid4())
