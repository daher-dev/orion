"""HTTP integration tests for the Supplies (insumos) router.

Covers permission gating (401 unauth, 403 without perms), CRUD happy paths
with the right status codes, the levels/movements aggregates, the on-hand
negative guard, and tenant isolation.
"""

import uuid

from httpx import AsyncClient

from models import Role
from tests.factories import (
    create_company,
    create_supply,
    create_supply_movement,
    create_user,
    get_role_by_code,
)

# ---------- helpers ----------


async def _seed_admin(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    return company, user


async def _seed_operator(db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(db_session, company_id=company.id, role_id=operator_role.id, firebase_uid="qa-dev-user")
    return company, user


async def _seed_no_permission(db_session):
    company = await create_company(db_session)
    role = Role(code=f"custom-no-supplies-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    user = await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="qa-dev-user")
    return company, user


# ---------- auth ----------


async def test_list_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/supplies")
    assert response.status_code == 401


async def test_list_forbidden_when_no_permission(authed_client: AsyncClient, db_session):
    await _seed_no_permission(db_session)
    response = await authed_client.get("/v1/supplies")
    assert response.status_code == 403


# ---------- GET /supplies ----------


async def test_list_empty(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get("/v1/supplies")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_list_returns_supplies(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    await create_supply(db_session, company_id=company.id, name="Linha", unit="m")
    response = await authed_client.get("/v1/supplies", params={"q": "lin"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Linha"
    assert body["items"][0]["unit"] == "m"


async def test_list_is_tenant_scoped(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    other = await create_company(db_session)
    await create_supply(db_session, company_id=company.id, name="Mine")
    await create_supply(db_session, company_id=other.id, name="Theirs")
    response = await authed_client.get("/v1/supplies")
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Mine"


# ---------- POST /supplies ----------


async def test_create_returns_201(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post(
        "/v1/supplies",
        json={"name": "Botão", "unit": "un", "unit_cost": "0.25", "min_stock": "500"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Botão"
    assert body["unit_cost"] == "0.25"
    assert body["min_stock"] == "500.000"


async def test_create_forbidden_without_write(authed_client: AsyncClient, db_session):
    await _seed_no_permission(db_session)
    response = await authed_client.post("/v1/supplies", json={"name": "X", "unit": "un", "unit_cost": "1"})
    assert response.status_code == 403


async def test_create_validation_error(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    # Empty name violates min_length=1.
    response = await authed_client.post("/v1/supplies", json={"name": "", "unit": "un", "unit_cost": "1"})
    assert response.status_code == 422


# ---------- GET /supplies/{id} ----------


async def test_get_returns_supply(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    supply = await create_supply(db_session, company_id=company.id, name="Etiqueta")
    response = await authed_client.get(f"/v1/supplies/{supply.id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Etiqueta"


async def test_get_foreign_returns_404(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    other = await create_company(db_session)
    foreign = await create_supply(db_session, company_id=other.id)
    response = await authed_client.get(f"/v1/supplies/{foreign.id}")
    assert response.status_code == 404


# ---------- PATCH /supplies/{id} ----------


async def test_patch_updates_supply(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    supply = await create_supply(db_session, company_id=company.id, name="Old")
    response = await authed_client.patch(f"/v1/supplies/{supply.id}", json={"name": "New"})
    assert response.status_code == 200
    assert response.json()["name"] == "New"


async def test_patch_forbidden_without_write(authed_client: AsyncClient, db_session):
    company, _ = await _seed_no_permission(db_session)
    supply = await create_supply(db_session, company_id=company.id)
    response = await authed_client.patch(f"/v1/supplies/{supply.id}", json={"name": "X"})
    assert response.status_code == 403


# ---------- DELETE /supplies/{id} ----------


async def test_delete_returns_204(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    supply = await create_supply(db_session, company_id=company.id)
    response = await authed_client.delete(f"/v1/supplies/{supply.id}")
    assert response.status_code == 204


async def test_delete_blocked_with_movements_returns_409(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    supply = await create_supply(db_session, company_id=company.id)
    await create_supply_movement(db_session, company_id=company.id, supply_id=supply.id)
    response = await authed_client.delete(f"/v1/supplies/{supply.id}")
    assert response.status_code == 409


async def test_delete_forbidden_without_write(authed_client: AsyncClient, db_session):
    company, _ = await _seed_no_permission(db_session)
    supply = await create_supply(db_session, company_id=company.id)
    response = await authed_client.delete(f"/v1/supplies/{supply.id}")
    assert response.status_code == 403


# ---------- GET /supplies/levels ----------


async def test_levels_returns_on_hand_aggregate(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    supply = await create_supply(db_session, company_id=company.id, name="Fita")
    # entry 20, exit 5 -> on-hand 15.
    create_resp = await authed_client.post(
        "/v1/supplies/movements",
        json={"supply_id": str(supply.id), "kind": "entry", "quantity": "20"},
    )
    assert create_resp.status_code == 201
    await authed_client.post(
        "/v1/supplies/movements",
        json={"supply_id": str(supply.id), "kind": "exit", "quantity": "5"},
    )
    response = await authed_client.get("/v1/supplies/levels")
    body = response.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["name"] == "Fita"
    assert item["on_hand"] == "15.000"
    assert item["entries_total"] == "20.000"
    assert item["exits_total"] == "5.000"


# ---------- GET /supplies/movements ----------


async def test_movements_returns_ledger(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    supply = await create_supply(db_session, company_id=company.id, name="Cola")
    await create_supply_movement(db_session, company_id=company.id, supply_id=supply.id)
    response = await authed_client.get("/v1/supplies/movements")
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["supply"]["name"] == "Cola"


# ---------- POST /supplies/movements ----------


async def test_create_movement_exit_beyond_on_hand_returns_409(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    supply = await create_supply(db_session, company_id=company.id)
    await authed_client.post(
        "/v1/supplies/movements",
        json={"supply_id": str(supply.id), "kind": "entry", "quantity": "3"},
    )
    response = await authed_client.post(
        "/v1/supplies/movements",
        json={"supply_id": str(supply.id), "kind": "exit", "quantity": "5"},
    )
    assert response.status_code == 409


async def test_create_movement_forbidden_without_write(authed_client: AsyncClient, db_session):
    company, _ = await _seed_no_permission(db_session)
    supply = await create_supply(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/supplies/movements",
        json={"supply_id": str(supply.id), "kind": "entry", "quantity": "1"},
    )
    assert response.status_code == 403
