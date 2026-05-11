import uuid

import pytest

from services.role import get_role, list_roles
from shared.exceptions import NotFoundError
from tests.factories import get_role_by_code


async def test_list_roles_returns_seeded_roles(db_session):
    roles = await list_roles(db_session)
    codes = {r.code for r in roles}
    # Seeded by migration 3187f02cbc35.
    assert {"admin", "manager", "operator"}.issubset(codes)


async def test_list_roles_sorted_by_code(db_session):
    roles = await list_roles(db_session)
    codes = [r.code for r in roles]
    assert codes == sorted(codes)


async def test_list_roles_eager_loads_permissions(db_session):
    roles = await list_roles(db_session)
    admin = next(r for r in roles if r.code == "admin")
    # Admin should have read+write across every domain (28 entries).
    assert len(admin.permissions) >= 20
    operator = next(r for r in roles if r.code == "operator")
    perm_codes = {p.code for p in operator.permissions}
    assert "cutting.write" in perm_codes
    assert "orders.write" not in perm_codes


async def test_get_role_happy_path(db_session):
    admin = await get_role_by_code(db_session, "admin")
    fetched = await get_role(db_session, admin.id)
    assert fetched.code == "admin"
    assert isinstance(fetched.permissions, list)
    assert len(fetched.permissions) > 0


async def test_get_role_404(db_session):
    with pytest.raises(NotFoundError):
        await get_role(db_session, uuid.uuid4())
