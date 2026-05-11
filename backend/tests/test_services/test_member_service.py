import uuid

import pytest
from sqlmodel import select

from models import AuditLog, User
from schemas._common import PageParams
from services.member import (
    get_member,
    list_members,
    remove_member,
    update_member_role,
)
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import create_company, create_user, get_role_by_code


async def _setup(db_session):
    company = await create_company(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    user = await create_user(db_session, company_id=company.id, role_id=admin_role.id)
    return company, user, admin_role


async def test_list_members_returns_tenant_rows_with_role_loaded(db_session):
    company, _, admin_role = await _setup(db_session)
    manager_role = await get_role_by_code(db_session, "manager")
    operator_role = await get_role_by_code(db_session, "operator")
    await create_user(db_session, company_id=company.id, role_id=manager_role.id, name="Manager One")
    await create_user(db_session, company_id=company.id, role_id=operator_role.id, name="Operator One")

    other_company = await create_company(db_session)
    await create_user(db_session, company_id=other_company.id, role_id=admin_role.id, name="Other Tenant")

    rows, total = await list_members(db_session, company.id, PageParams())
    assert total == 3
    role_codes = {m.role.code for m in rows}
    assert role_codes == {"admin", "manager", "operator"}
    # Eager-loaded permissions
    for m in rows:
        assert isinstance(m.role.permissions, list)


async def test_list_members_paginates(db_session):
    company, _, admin_role = await _setup(db_session)
    for i in range(4):
        await create_user(db_session, company_id=company.id, role_id=admin_role.id, name=f"M{i}")

    rows, total = await list_members(db_session, company.id, PageParams(page=1, page_size=2))
    assert total == 5  # original admin + 4
    assert len(rows) == 2

    page3, _ = await list_members(db_session, company.id, PageParams(page=3, page_size=2))
    assert len(page3) == 1


async def test_get_member_happy_path(db_session):
    company, admin, _ = await _setup(db_session)
    found = await get_member(db_session, company.id, admin.id)
    assert found.id == admin.id
    assert found.role.code == "admin"


async def test_get_member_404(db_session):
    company, _, _ = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await get_member(db_session, company.id, uuid.uuid4())


async def test_get_member_not_across_tenants(db_session):
    company, _, admin_role = await _setup(db_session)
    other = await create_company(db_session)
    other_user = await create_user(db_session, company_id=other.id, role_id=admin_role.id)
    with pytest.raises(NotFoundError):
        await get_member(db_session, company.id, other_user.id)


async def test_update_member_role_changes_role_and_audits(db_session):
    company, admin, _ = await _setup(db_session)
    manager_role = await get_role_by_code(db_session, "manager")
    # Add a second admin so demotion is allowed.
    second_admin = await create_user(
        db_session,
        company_id=company.id,
        role_id=admin.role_id,
        name="Second Admin",
    )

    updated = await update_member_role(
        db_session,
        company.id,
        admin.id,
        second_admin.id,
        manager_role.id,
    )
    assert updated.role_id == manager_role.id
    assert updated.role.code == "manager"

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == second_admin.id))).all()
    assert any("Changed role of" in a.message and "Manager" in a.message for a in audits)


async def test_update_member_role_no_op_returns_unchanged(db_session):
    company, admin, admin_role = await _setup(db_session)
    updated = await update_member_role(db_session, company.id, admin.id, admin.id, admin_role.id)
    assert updated.id == admin.id
    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == admin.id))).all()
    # No audit should be written for a no-op.
    assert not any("Changed role of" in a.message for a in audits)


async def test_update_member_role_404_when_member_missing(db_session):
    company, admin, admin_role = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await update_member_role(db_session, company.id, admin.id, uuid.uuid4(), admin_role.id)


async def test_update_member_role_404_when_role_missing(db_session):
    company, admin, _ = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await update_member_role(db_session, company.id, admin.id, admin.id, uuid.uuid4())


async def test_update_member_role_blocks_last_admin_demotion(db_session):
    company, admin, _ = await _setup(db_session)
    manager_role = await get_role_by_code(db_session, "manager")
    with pytest.raises(ConflictError):
        await update_member_role(db_session, company.id, admin.id, admin.id, manager_role.id)


async def test_update_member_role_allows_demotion_when_other_admin_exists(db_session):
    company, admin, admin_role = await _setup(db_session)
    await create_user(db_session, company_id=company.id, role_id=admin_role.id, name="Backup Admin")
    manager_role = await get_role_by_code(db_session, "manager")
    updated = await update_member_role(db_session, company.id, admin.id, admin.id, manager_role.id)
    assert updated.role.code == "manager"


async def test_update_member_role_promotion_to_admin(db_session):
    company, admin, _ = await _setup(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    op = await create_user(db_session, company_id=company.id, role_id=operator_role.id)
    admin_role = await get_role_by_code(db_session, "admin")
    updated = await update_member_role(db_session, company.id, admin.id, op.id, admin_role.id)
    assert updated.role.code == "admin"


async def test_remove_member_hard_deletes_and_audits(db_session):
    company, admin, _ = await _setup(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    op = await create_user(db_session, company_id=company.id, role_id=operator_role.id, name="Op X")

    await remove_member(db_session, company.id, admin.id, op.id)

    remaining = (await db_session.exec(select(User).where(User.id == op.id))).first()
    assert remaining is None

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == op.id))).all()
    assert any("Removed member" in a.message for a in audits)


async def test_remove_member_404_when_missing(db_session):
    company, admin, _ = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await remove_member(db_session, company.id, admin.id, uuid.uuid4())


async def test_remove_member_blocks_last_admin(db_session):
    company, admin, _ = await _setup(db_session)
    with pytest.raises(ConflictError):
        await remove_member(db_session, company.id, admin.id, admin.id)


async def test_remove_member_allows_removal_when_other_admin_exists(db_session):
    company, admin, admin_role = await _setup(db_session)
    backup = await create_user(db_session, company_id=company.id, role_id=admin_role.id, name="Backup")
    await remove_member(db_session, company.id, backup.id, admin.id)
    remaining = (await db_session.exec(select(User).where(User.id == admin.id))).first()
    assert remaining is None


async def test_remove_member_does_not_cross_tenants(db_session):
    company, admin, admin_role = await _setup(db_session)
    other = await create_company(db_session)
    other_user = await create_user(db_session, company_id=other.id, role_id=admin_role.id)
    with pytest.raises(NotFoundError):
        await remove_member(db_session, company.id, admin.id, other_user.id)
