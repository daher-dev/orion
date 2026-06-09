import uuid

import pytest

from schemas.role import RoleCreate, RoleUpdate
from services.role import (
    create_role,
    delete_role,
    get_role,
    list_roles,
    update_role,
)
from shared.exceptions import ConflictError, NotFoundError, ValidationError
from tests.factories import create_company, create_user, get_role_by_code


async def test_list_roles_returns_seeded_roles(db_session):
    company = await create_company(db_session)
    roles = await list_roles(db_session, company.id)
    codes = {r.code for r in roles}
    # Seeded by migration 3187f02cbc35 — global (company_id NULL) for every tenant.
    assert {"admin", "manager", "operator"}.issubset(codes)


async def test_list_roles_sorted_by_code(db_session):
    company = await create_company(db_session)
    roles = await list_roles(db_session, company.id)
    codes = [r.code for r in roles]
    assert codes == sorted(codes)


async def test_list_roles_eager_loads_permissions(db_session):
    company = await create_company(db_session)
    roles = await list_roles(db_session, company.id)
    admin = next(r for r in roles if r.code == "admin")
    # Admin should have read+write across every domain (28 entries).
    assert len(admin.permissions) >= 20
    operator = next(r for r in roles if r.code == "operator")
    perm_codes = {p.code for p in operator.permissions}
    assert "cutting.write" in perm_codes
    assert "orders.write" not in perm_codes


async def test_get_role_happy_path(db_session):
    company = await create_company(db_session)
    admin = await get_role_by_code(db_session, "admin")
    fetched = await get_role(db_session, company.id, admin.id)
    assert fetched.code == "admin"
    assert isinstance(fetched.permissions, list)
    assert len(fetched.permissions) > 0


async def test_get_role_404(db_session):
    company = await create_company(db_session)
    with pytest.raises(NotFoundError):
        await get_role(db_session, company.id, uuid.uuid4())


# --- Custom role CRUD ---------------------------------------------------------


async def test_create_role_persists_with_permissions(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    role = await create_role(
        db_session,
        company.id,
        user.id,
        RoleCreate(
            code="sales",
            name="Sales",
            description="Sales team",
            permission_codes=["clients.read", "orders.read"],
        ),
    )
    assert role.company_id == company.id
    assert role.code == "sales"
    assert {p.code for p in role.permissions} == {"clients.read", "orders.read"}


async def test_created_custom_role_appears_in_company_list(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    await create_role(db_session, company.id, user.id, RoleCreate(code="sales", name="Sales"))
    roles = await list_roles(db_session, company.id)
    codes = {r.code for r in roles}
    assert "sales" in codes
    assert {"admin", "manager", "operator"}.issubset(codes)


async def test_create_role_rejects_reserved_code(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    with pytest.raises(ConflictError):
        await create_role(db_session, company.id, user.id, RoleCreate(code="admin", name="Fake Admin"))


async def test_create_role_rejects_unknown_permission_code(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    with pytest.raises(ValidationError):
        await create_role(
            db_session,
            company.id,
            user.id,
            RoleCreate(code="sales", name="Sales", permission_codes=["does.not_exist"]),
        )


async def test_create_role_rejects_duplicate_code_same_company(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    await create_role(db_session, company.id, user.id, RoleCreate(code="sales", name="Sales"))
    with pytest.raises(ConflictError):
        await create_role(db_session, company.id, user.id, RoleCreate(code="sales", name="Sales 2"))


async def test_two_companies_can_reuse_the_same_code(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_a = await create_user(db_session, company_id=company_a.id)
    user_b = await create_user(db_session, company_id=company_b.id)
    role_a = await create_role(db_session, company_a.id, user_a.id, RoleCreate(code="sales", name="Sales A"))
    role_b = await create_role(db_session, company_b.id, user_b.id, RoleCreate(code="sales", name="Sales B"))
    assert role_a.id != role_b.id
    assert role_a.company_id == company_a.id
    assert role_b.company_id == company_b.id


async def test_custom_role_not_visible_to_other_company(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_a = await create_user(db_session, company_id=company_a.id)
    role_a = await create_role(db_session, company_a.id, user_a.id, RoleCreate(code="sales", name="Sales A"))

    # Company B's list excludes A's custom role but keeps the globals.
    roles_b = await list_roles(db_session, company_b.id)
    assert all(r.id != role_a.id for r in roles_b)
    assert {"admin", "manager", "operator"}.issubset({r.code for r in roles_b})

    # And B cannot fetch it by id (hidden as 404).
    with pytest.raises(NotFoundError):
        await get_role(db_session, company_b.id, role_a.id)


async def test_update_role_replaces_permissions(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    role = await create_role(
        db_session,
        company.id,
        user.id,
        RoleCreate(code="sales", name="Sales", permission_codes=["clients.read"]),
    )
    updated = await update_role(
        db_session,
        company.id,
        user.id,
        role.id,
        RoleUpdate(name="Sales Pro", permission_codes=["orders.read", "orders.write"]),
    )
    assert updated.name == "Sales Pro"
    assert {p.code for p in updated.permissions} == {"orders.read", "orders.write"}


async def test_update_role_partial_keeps_permissions(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    role = await create_role(
        db_session,
        company.id,
        user.id,
        RoleCreate(code="sales", name="Sales", permission_codes=["clients.read"]),
    )
    # No permission_codes in the payload → existing permissions untouched.
    updated = await update_role(db_session, company.id, user.id, role.id, RoleUpdate(name="Renamed"))
    assert updated.name == "Renamed"
    assert {p.code for p in updated.permissions} == {"clients.read"}


async def test_update_seeded_role_is_rejected(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    admin = await get_role_by_code(db_session, "admin")
    with pytest.raises(ConflictError):
        await update_role(db_session, company.id, user.id, admin.id, RoleUpdate(name="Hacked"))


async def test_delete_custom_role(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    role = await create_role(db_session, company.id, user.id, RoleCreate(code="sales", name="Sales"))
    await delete_role(db_session, company.id, user.id, role.id)
    with pytest.raises(NotFoundError):
        await get_role(db_session, company.id, role.id)


async def test_delete_seeded_role_is_rejected(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    operator = await get_role_by_code(db_session, "operator")
    with pytest.raises(ConflictError):
        await delete_role(db_session, company.id, user.id, operator.id)


async def test_delete_role_in_use_is_rejected(db_session):
    company = await create_company(db_session)
    actor = await create_user(db_session, company_id=company.id)
    role = await create_role(db_session, company.id, actor.id, RoleCreate(code="sales", name="Sales"))
    # Assign a member to the custom role, then deletion must 409.
    await create_user(db_session, company_id=company.id, role_id=role.id)
    with pytest.raises(ConflictError):
        await delete_role(db_session, company.id, actor.id, role.id)
