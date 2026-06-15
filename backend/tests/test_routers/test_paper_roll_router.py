"""HTTP integration tests for the Paper Rolls (bobinas de papel/filme) router.

Covers permission gating (401 unauth, 403 without perms), CRUD happy paths with
the right status codes, the consume + movements endpoints, the delete-block,
Decimal string serialization, and tenant isolation.
"""

import uuid

from httpx import AsyncClient

from models import Role
from tests.factories import (
    create_company,
    create_paper_roll,
    create_paper_roll_movement,
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
    role = Role(code=f"custom-no-paper-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    user = await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="qa-dev-user")
    return company, user


def _create_body(**overrides) -> dict:
    base = {
        "received_at": "2026-06-01",
        "supplier_name": "DTF Brasil",
        "paper_type": "dtf_film",
        "width_cm": 60,
        "initial_meters": "100.00",
    }
    base.update(overrides)
    return base


# ---------- auth ----------


async def test_list_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/paper-rolls")
    assert response.status_code == 401


async def test_list_forbidden_when_no_permission(authed_client: AsyncClient, db_session):
    await _seed_no_permission(db_session)
    response = await authed_client.get("/v1/paper-rolls")
    assert response.status_code == 403


# ---------- GET /paper-rolls ----------


async def test_list_empty(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get("/v1/paper-rolls")
    assert response.status_code == 200
    assert response.json()["total"] == 0


async def test_list_returns_rolls_with_computed_fields(authed_client: AsyncClient, db_session):
    company, _user = await _seed_admin(db_session)
    await create_paper_roll(
        db_session,
        company_id=company.id,
        supplier_name="DTF Brasil",
        initial_meters="100.00",
        current_meters="64.00",
    )
    response = await authed_client.get("/v1/paper-rolls", params={"q": "dtf"})
    body = response.json()
    assert body["total"] == 1
    item = body["items"][0]
    # Decimal columns serialize as strings.
    assert item["current_meters"] == "64.00"
    assert item["consumed_meters"] == "36.00"
    assert item["on_hand"] == "64.00"


async def test_list_is_tenant_scoped(authed_client: AsyncClient, db_session):
    company, _user = await _seed_admin(db_session)
    other = await create_company(db_session)
    await create_paper_roll(db_session, company_id=company.id)
    await create_paper_roll(db_session, company_id=other.id)
    response = await authed_client.get("/v1/paper-rolls")
    assert response.json()["total"] == 1


# ---------- POST /paper-rolls ----------


async def test_create_returns_201(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post("/v1/paper-rolls", json=_create_body())
    assert response.status_code == 201
    body = response.json()
    assert body["supplier_name"] == "DTF Brasil"
    # current defaults to initial when omitted.
    assert body["current_meters"] == "100.00"


async def test_create_current_exceeds_initial_returns_409(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post("/v1/paper-rolls", json=_create_body(current_meters="150.00"))
    assert response.status_code == 409


async def test_create_validation_error(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    # width_cm must be > 0.
    response = await authed_client.post("/v1/paper-rolls", json=_create_body(width_cm=0))
    assert response.status_code == 422


async def test_create_forbidden_without_write(authed_client: AsyncClient, db_session):
    await _seed_no_permission(db_session)
    response = await authed_client.post("/v1/paper-rolls", json=_create_body())
    assert response.status_code == 403


# ---------- GET /paper-rolls/{id} ----------


async def test_get_returns_roll(authed_client: AsyncClient, db_session):
    company, _user = await _seed_admin(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, supplier_name="SubliPrint")
    response = await authed_client.get(f"/v1/paper-rolls/{roll.id}")
    assert response.status_code == 200
    assert response.json()["supplier_name"] == "SubliPrint"


async def test_get_foreign_returns_404(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    other = await create_company(db_session)
    foreign = await create_paper_roll(db_session, company_id=other.id)
    response = await authed_client.get(f"/v1/paper-rolls/{foreign.id}")
    assert response.status_code == 404


# ---------- PATCH /paper-rolls/{id} ----------


async def test_patch_updates_roll(authed_client: AsyncClient, db_session):
    company, _user = await _seed_admin(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, supplier_name="Old")
    response = await authed_client.patch(f"/v1/paper-rolls/{roll.id}", json={"supplier_name": "New"})
    assert response.status_code == 200
    assert response.json()["supplier_name"] == "New"


# ---------- POST /paper-rolls/{id}/consume ----------


async def test_consume_debits_meters(authed_client: AsyncClient, db_session):
    company, _user = await _seed_admin(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, current_meters="64.00")
    response = await authed_client.post(f"/v1/paper-rolls/{roll.id}/consume", json={"quantity": "22.000"})
    assert response.status_code == 200
    assert response.json()["current_meters"] == "42.00"


async def test_consume_clamps_at_zero(authed_client: AsyncClient, db_session):
    company, _user = await _seed_admin(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, current_meters="5.00")
    response = await authed_client.post(f"/v1/paper-rolls/{roll.id}/consume", json={"quantity": "18.000"})
    assert response.status_code == 200
    assert response.json()["current_meters"] == "0.00"


# ---------- DELETE /paper-rolls/{id} ----------


async def test_delete_returns_204(authed_client: AsyncClient, db_session):
    company, _user = await _seed_admin(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id)
    response = await authed_client.delete(f"/v1/paper-rolls/{roll.id}")
    assert response.status_code == 204


async def test_delete_blocked_with_movements_returns_409(authed_client: AsyncClient, db_session):
    company, _user = await _seed_admin(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id)
    await create_paper_roll_movement(db_session, company_id=company.id, paper_roll_id=roll.id)
    response = await authed_client.delete(f"/v1/paper-rolls/{roll.id}")
    assert response.status_code == 409


# ---------- GET/POST /paper-rolls/movements ----------


async def test_create_movement_returns_201(authed_client: AsyncClient, db_session):
    company, _user = await _seed_admin(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, current_meters="40.00")
    response = await authed_client.post(
        "/v1/paper-rolls/movements",
        json={"paper_roll_id": str(roll.id), "kind": "entry", "quantity": "10.000"},
    )
    assert response.status_code == 201
    # The /movements path is matched BEFORE /{roll_id} — confirm no 404/422 collision.
    assert response.json()["quantity"] == "10.000"


async def test_movements_returns_ledger(authed_client: AsyncClient, db_session):
    company, _user = await _seed_admin(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id)
    await create_paper_roll_movement(db_session, company_id=company.id, paper_roll_id=roll.id)
    response = await authed_client.get("/v1/paper-rolls/movements")
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["paper_roll"]["supplier_name"] == roll.supplier_name


async def test_operator_can_consume(authed_client: AsyncClient, db_session):
    company, _user = await _seed_operator(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, current_meters="30.00")
    response = await authed_client.post(f"/v1/paper-rolls/{roll.id}/consume", json={"quantity": "10.000"})
    assert response.status_code == 200
