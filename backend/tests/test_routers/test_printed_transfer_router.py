"""HTTP integration tests for the Printed Transfers (estampados) router.

Covers permission gating (401 unauth, 403 without perms), the levels/movements
aggregates, create-key + movement happy paths with the right status codes, the
on-hand negative guard, and tenant isolation. Replaces the old print_stock
router tests.
"""

import uuid

from httpx import AsyncClient

from models import Role
from tests.factories import (
    create_company,
    create_print_design,
    create_printed_transfer,
    create_user,
    get_role_by_code,
)

# ---------- helpers ----------


async def _seed_admin(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    design = await create_print_design(db_session, company_id=company.id, name="Naruto — Akatsuki")
    return company, user, design


async def _seed_operator(db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(db_session, company_id=company.id, role_id=operator_role.id, firebase_uid="qa-dev-user")
    design = await create_print_design(db_session, company_id=company.id)
    return company, user, design


async def _seed_no_permission(db_session):
    company = await create_company(db_session)
    role = Role(code=f"custom-no-printed-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    user = await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="qa-dev-user")
    return company, user


# ---------- auth ----------


async def test_levels_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/printed-transfers/levels")
    assert response.status_code == 401


async def test_levels_forbidden_when_no_permission(authed_client: AsyncClient, db_session):
    await _seed_no_permission(db_session)
    response = await authed_client.get("/v1/printed-transfers/levels")
    assert response.status_code == 403


# ---------- GET /printed-transfers/levels ----------


async def test_levels_empty(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get("/v1/printed-transfers/levels")
    assert response.status_code == 200
    assert response.json()["total"] == 0


async def test_levels_surfaces_row_without_movements(authed_client: AsyncClient, db_session):
    company, _user, design = await _seed_admin(db_session)
    await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    response = await authed_client.get("/v1/printed-transfers/levels")
    body = response.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["on_hand"] == 0
    assert item["in_production"] == 0
    assert item["side"] == "front"
    assert item["design"]["code"] == design.code


async def test_levels_is_tenant_scoped(authed_client: AsyncClient, db_session):
    company, _user, design = await _seed_admin(db_session)
    other = await create_company(db_session)
    other_design = await create_print_design(db_session, company_id=other.id)
    await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    await create_printed_transfer(db_session, company_id=other.id, print_design_id=other_design.id)
    response = await authed_client.get("/v1/printed-transfers/levels")
    assert response.json()["total"] == 1


# ---------- POST /printed-transfers ----------


async def test_create_returns_201(authed_client: AsyncClient, db_session):
    _company, _user, design = await _seed_admin(db_session)
    response = await authed_client.post(
        "/v1/printed-transfers",
        json={"print_design_id": str(design.id), "side": "front", "min_stock": 15},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["side"] == "front"
    assert body["on_hand"] == 0
    assert body["min_stock"] == 15


async def test_create_duplicate_returns_409(authed_client: AsyncClient, db_session):
    _company, _user, design = await _seed_admin(db_session)
    body = {"print_design_id": str(design.id), "side": "front"}
    await authed_client.post("/v1/printed-transfers", json=body)
    response = await authed_client.post("/v1/printed-transfers", json=body)
    assert response.status_code == 409


async def test_create_forbidden_without_write(authed_client: AsyncClient, db_session):
    company, _user = await _seed_no_permission(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/printed-transfers", json={"print_design_id": str(design.id), "side": "front"}
    )
    assert response.status_code == 403


# ---------- POST /printed-transfers/movements ----------


async def test_create_movement_returns_201_and_updates_levels(authed_client: AsyncClient, db_session):
    company, _user, design = await _seed_admin(db_session)
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    response = await authed_client.post(
        "/v1/printed-transfers/movements",
        json={"printed_transfer_id": str(transfer.id), "kind": "entry", "quantity": 30},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["quantity"] == 30
    assert body["side"] == "front"
    assert body["design"]["code"] == design.code

    levels = await authed_client.get("/v1/printed-transfers/levels")
    assert levels.json()["items"][0]["on_hand"] == 30


async def test_create_movement_exit_beyond_on_hand_returns_409(authed_client: AsyncClient, db_session):
    company, _user, design = await _seed_admin(db_session)
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    await authed_client.post(
        "/v1/printed-transfers/movements",
        json={"printed_transfer_id": str(transfer.id), "kind": "entry", "quantity": 2},
    )
    response = await authed_client.post(
        "/v1/printed-transfers/movements",
        json={"printed_transfer_id": str(transfer.id), "kind": "exit", "quantity": 5},
    )
    assert response.status_code == 409


async def test_create_movement_forbidden_without_write(authed_client: AsyncClient, db_session):
    company, _user = await _seed_no_permission(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    response = await authed_client.post(
        "/v1/printed-transfers/movements",
        json={"printed_transfer_id": str(transfer.id), "kind": "entry", "quantity": 1},
    )
    assert response.status_code == 403


async def test_operator_can_create_movement(authed_client: AsyncClient, db_session):
    company, _user, design = await _seed_operator(db_session)
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    response = await authed_client.post(
        "/v1/printed-transfers/movements",
        json={"printed_transfer_id": str(transfer.id), "kind": "entry", "quantity": 5},
    )
    assert response.status_code == 201


# ---------- GET /printed-transfers/movements ----------


async def test_movements_returns_ledger(authed_client: AsyncClient, db_session):
    company, _user, design = await _seed_admin(db_session)
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    await authed_client.post(
        "/v1/printed-transfers/movements",
        json={"printed_transfer_id": str(transfer.id), "kind": "entry", "quantity": 7},
    )
    response = await authed_client.get("/v1/printed-transfers/movements")
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["design"]["code"] == design.code
    assert body["items"][0]["side"] == "front"
