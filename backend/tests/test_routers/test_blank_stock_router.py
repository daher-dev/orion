"""HTTP integration tests for the Blank Stock (peças lisas) router.

Covers permission gating (401 unauth, 403 without perms), the levels/movements
aggregates, the create-key + movement happy paths with the right status codes,
the on-hand negative guard, and tenant isolation.
"""

import uuid

from httpx import AsyncClient

from models import Role
from tests.factories import (
    create_blank_piece,
    create_company,
    create_product_spec,
    create_user,
    get_role_by_code,
)

# ---------- helpers ----------


async def _seed_admin(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    spec = await create_product_spec(db_session, company_id=company.id)
    return company, user, spec


async def _seed_operator(db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(db_session, company_id=company.id, role_id=operator_role.id, firebase_uid="qa-dev-user")
    spec = await create_product_spec(db_session, company_id=company.id)
    return company, user, spec


async def _seed_no_permission(db_session):
    company = await create_company(db_session)
    role = Role(code=f"custom-no-blank-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    user = await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="qa-dev-user")
    return company, user


# ---------- auth ----------


async def test_levels_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/blank-stock/levels")
    assert response.status_code == 401


async def test_levels_forbidden_when_no_permission(authed_client: AsyncClient, db_session):
    await _seed_no_permission(db_session)
    response = await authed_client.get("/v1/blank-stock/levels")
    assert response.status_code == 403


# ---------- GET /blank-stock/levels ----------


async def test_levels_empty(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get("/v1/blank-stock/levels")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_levels_surfaces_row_without_movements(authed_client: AsyncClient, db_session):
    company, _user, spec = await _seed_admin(db_session)
    await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id, color="Preto")
    response = await authed_client.get("/v1/blank-stock/levels")
    body = response.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["on_hand"] == 0
    assert item["in_production"] == 0
    assert item["color"] == "Preto"
    assert item["spec"]["code"] == spec.code


async def test_levels_is_tenant_scoped(authed_client: AsyncClient, db_session):
    company, _user, spec = await _seed_admin(db_session)
    other = await create_company(db_session)
    other_spec = await create_product_spec(db_session, company_id=other.id)
    await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    await create_blank_piece(db_session, company_id=other.id, spec_id=other_spec.id)
    response = await authed_client.get("/v1/blank-stock/levels")
    assert response.json()["total"] == 1


# ---------- POST /blank-stock ----------


async def test_create_blank_piece_returns_201(authed_client: AsyncClient, db_session):
    _company, _user, spec = await _seed_admin(db_session)
    response = await authed_client.post(
        "/v1/blank-stock",
        json={"spec_id": str(spec.id), "size": "m", "color": "Preto", "color_code": "BLK", "min_stock": 40},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["color_code"] == "BLK"
    assert body["on_hand"] == 0
    assert body["min_stock"] == 40


async def test_create_blank_piece_validation_error(authed_client: AsyncClient, db_session):
    _company, _user, spec = await _seed_admin(db_session)
    # color_code must match ^[A-Z]{3}$.
    response = await authed_client.post(
        "/v1/blank-stock",
        json={"spec_id": str(spec.id), "size": "m", "color": "Preto", "color_code": "bl"},
    )
    assert response.status_code == 422


async def test_create_blank_piece_forbidden_without_write(authed_client: AsyncClient, db_session):
    company, _user = await _seed_no_permission(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/blank-stock",
        json={"spec_id": str(spec.id), "size": "m", "color": "X", "color_code": "XXX"},
    )
    assert response.status_code == 403


# ---------- POST /blank-stock/movements ----------


async def test_create_movement_returns_201_and_updates_levels(authed_client: AsyncClient, db_session):
    company, _user, spec = await _seed_admin(db_session)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    response = await authed_client.post(
        "/v1/blank-stock/movements",
        json={"blank_piece_id": str(piece.id), "kind": "entry", "quantity": 60},
    )
    assert response.status_code == 201
    assert response.json()["quantity"] == 60

    levels = await authed_client.get("/v1/blank-stock/levels")
    assert levels.json()["items"][0]["on_hand"] == 60


async def test_create_movement_exit_beyond_on_hand_returns_409(authed_client: AsyncClient, db_session):
    company, _user, spec = await _seed_admin(db_session)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    await authed_client.post(
        "/v1/blank-stock/movements",
        json={"blank_piece_id": str(piece.id), "kind": "entry", "quantity": 3},
    )
    response = await authed_client.post(
        "/v1/blank-stock/movements",
        json={"blank_piece_id": str(piece.id), "kind": "exit", "quantity": 5},
    )
    assert response.status_code == 409


async def test_create_movement_forbidden_without_write(authed_client: AsyncClient, db_session):
    company, _user = await _seed_no_permission(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    response = await authed_client.post(
        "/v1/blank-stock/movements",
        json={"blank_piece_id": str(piece.id), "kind": "entry", "quantity": 1},
    )
    assert response.status_code == 403


# ---------- operator role can write ----------


async def test_operator_can_create_movement(authed_client: AsyncClient, db_session):
    company, _user, spec = await _seed_operator(db_session)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    response = await authed_client.post(
        "/v1/blank-stock/movements",
        json={"blank_piece_id": str(piece.id), "kind": "entry", "quantity": 5},
    )
    assert response.status_code == 201


# ---------- GET /blank-stock/movements ----------


async def test_movements_returns_ledger(authed_client: AsyncClient, db_session):
    company, _user, spec = await _seed_admin(db_session)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    await authed_client.post(
        "/v1/blank-stock/movements",
        json={"blank_piece_id": str(piece.id), "kind": "entry", "quantity": 7},
    )
    response = await authed_client.get("/v1/blank-stock/movements")
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["blank_piece"]["spec_code"] == spec.code
