"""Integration-style tests for dependencies.py — exercised via a real ASGI client."""

import pytest
from fastapi import APIRouter, Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from dependencies import CurrentDbUser, RequirePermission
from main import app
from models import Role
from tests.factories import create_company, create_user, get_role_by_code


def _make_test_app() -> FastAPI:
    """Spin up a tiny app that mounts probe endpoints on top of `app`'s overrides.

    We mount onto the *same* `main.app` so the existing dependency overrides
    (DB session etc.) configured in conftest.py apply automatically.
    """

    probe_router = APIRouter(prefix="/_probe", tags=["probe"])

    @probe_router.get("/whoami")
    async def whoami(user: CurrentDbUser):
        return {"id": str(user.id), "company_id": str(user.company_id)}

    @probe_router.get("/needs-write", dependencies=[Depends(RequirePermission("orders.write"))])
    async def needs_write():
        return {"ok": True}

    @probe_router.get(
        "/needs-multi",
        dependencies=[Depends(RequirePermission("orders.write", "stock.write"))],
    )
    async def needs_multi():
        return {"ok": True}

    if not any(getattr(r, "path", "").startswith("/_probe") for r in app.router.routes):
        app.include_router(probe_router)
    return app


@pytest.fixture
async def probe_client():
    test_app = _make_test_app()
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as client:
        yield client


async def test_get_current_db_user_missing_token(probe_client):
    response = await probe_client.get("/_probe/whoami")
    assert response.status_code == 401


async def test_get_current_db_user_no_matching_user(probe_client):
    response = await probe_client.get(
        "/_probe/whoami",
        headers={"X-Dev-Bypass-Uid": "ghost-uid"},
    )
    assert response.status_code == 401
    assert "User not found" in response.json()["detail"]


async def test_get_current_db_user_picks_oldest_membership_by_default(db_session, probe_client):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_a = await create_user(db_session, company_id=company_a.id, firebase_uid="multi-uid")
    await create_user(db_session, company_id=company_b.id, firebase_uid="multi-uid")

    response = await probe_client.get(
        "/_probe/whoami",
        headers={"X-Dev-Bypass-Uid": "multi-uid"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(user_a.id)
    assert body["company_id"] == str(company_a.id)


async def test_get_current_db_user_honours_company_header(db_session, probe_client):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    await create_user(db_session, company_id=company_a.id, firebase_uid="multi-uid")
    user_b = await create_user(db_session, company_id=company_b.id, firebase_uid="multi-uid")

    response = await probe_client.get(
        "/_probe/whoami",
        headers={
            "X-Dev-Bypass-Uid": "multi-uid",
            "X-Orion-Company-Id": str(company_b.id),
        },
    )
    assert response.status_code == 200
    assert response.json()["id"] == str(user_b.id)


async def test_require_permission_grants_when_role_has_code(db_session, probe_client):
    role = await get_role_by_code(db_session, "manager")
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="mgr-uid")

    response = await probe_client.get(
        "/_probe/needs-write",
        headers={"X-Dev-Bypass-Uid": "mgr-uid"},
    )
    assert response.status_code == 200


async def test_require_permission_blocks_when_missing(db_session, probe_client):
    role = await get_role_by_code(db_session, "operator")
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="op-uid")

    response = await probe_client.get(
        "/_probe/needs-write",
        headers={"X-Dev-Bypass-Uid": "op-uid"},
    )
    assert response.status_code == 403
    assert "orders.write" in response.json()["detail"]


async def test_require_permission_reports_all_missing_codes(db_session, probe_client):
    role = await get_role_by_code(db_session, "operator")
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="op-uid")

    response = await probe_client.get(
        "/_probe/needs-multi",
        headers={"X-Dev-Bypass-Uid": "op-uid"},
    )
    assert response.status_code == 403
    detail = response.json()["detail"]
    # operator has stock.write, lacks orders.write — only the latter should appear.
    assert "orders.write" in detail
    assert "stock.write" not in detail


async def test_require_permission_passes_when_all_codes_present(db_session, probe_client):
    role = await get_role_by_code(db_session, "admin")
    _ = role  # silence unused
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="admin-uid")

    response = await probe_client.get(
        "/_probe/needs-multi",
        headers={"X-Dev-Bypass-Uid": "admin-uid"},
    )
    assert response.status_code == 200


async def test_role_relationship_loads_permissions(db_session):
    role = await get_role_by_code(db_session, "admin")
    assert isinstance(role, Role)
    assert any(p.code == "orders.write" for p in role.permissions)
