"""HTTP integration tests for the Print Orders (Impressão) router — T4.

Covers permission gating (401 unauth, 403 without perms, operator allowed),
the CRUD status codes, create validation (silkscreen 422, paper mismatch 422),
the complete endpoint's stock effects + idempotency, and tenant isolation.
"""

import uuid

from httpx import AsyncClient

from models import PaperType, PrintTechnique, Role
from schemas.print_order import PrintOrderCreate
from services import print_order as print_order_service
from tests.factories import (
    create_company,
    create_paper_roll,
    create_print_design,
    create_print_design_variation,
    create_user,
    get_role_by_code,
)


async def _seed_admin(db_session, *, technique=PrintTechnique.DTF):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    design = await create_print_design(db_session, company_id=company.id, technique=technique, has_front=True)
    variation = await create_print_design_variation(db_session, company_id=company.id, print_design_id=design.id)
    return company, user, design, variation


async def _seed_operator(db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(db_session, company_id=company.id, role_id=operator_role.id, firebase_uid="qa-dev-user")
    design = await create_print_design(db_session, company_id=company.id, has_front=True)
    variation = await create_print_design_variation(db_session, company_id=company.id, print_design_id=design.id)
    return company, user, design, variation


async def _seed_no_permission(db_session):
    company = await create_company(db_session)
    role = Role(code=f"custom-no-print-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    user = await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="qa-dev-user")
    return company, user


# ---------- auth ----------


async def test_list_unauthenticated_401(async_client: AsyncClient):
    response = await async_client.get("/v1/print-orders")
    assert response.status_code == 401


async def test_list_forbidden_without_permission(authed_client: AsyncClient, db_session):
    await _seed_no_permission(db_session)
    response = await authed_client.get("/v1/print-orders")
    assert response.status_code == 403


async def test_operator_can_create(authed_client: AsyncClient, db_session):
    _company, _user, design, _variation = await _seed_operator(db_session)
    response = await authed_client.post("/v1/print-orders", json={"print_design_id": str(design.id)})
    assert response.status_code == 201


# ---------- CRUD ----------


async def test_create_and_get(authed_client: AsyncClient, db_session):
    _company, _user, design, variation = await _seed_admin(db_session)
    create = await authed_client.post(
        "/v1/print-orders",
        json={
            "print_design_id": str(design.id),
            "planned_outputs": [
                {"print_design_variation_id": str(variation.id), "side": "front", "planned_quantity": 8}
            ],
        },
    )
    assert create.status_code == 201
    body = create.json()
    assert body["status"] == "pending"
    assert body["total_planned"] == 8

    got = await authed_client.get(f"/v1/print-orders/{body['id']}")
    assert got.status_code == 200
    assert got.json()["id"] == body["id"]


async def test_create_silkscreen_422(authed_client: AsyncClient, db_session):
    _company, _user, design, _variation = await _seed_admin(db_session, technique=PrintTechnique.SILKSCREEN)
    response = await authed_client.post("/v1/print-orders", json={"print_design_id": str(design.id)})
    assert response.status_code == 422


async def test_create_paper_mismatch_422(authed_client: AsyncClient, db_session):
    company, _user, design, _variation = await _seed_admin(db_session, technique=PrintTechnique.DTF)
    roll = await create_paper_roll(db_session, company_id=company.id, paper_type=PaperType.SUBLIMATION_PAPER)
    response = await authed_client.post(
        "/v1/print-orders", json={"print_design_id": str(design.id), "paper_roll_id": str(roll.id)}
    )
    assert response.status_code == 422


async def test_patch_bad_transition_409(authed_client: AsyncClient, db_session):
    _company, _user, design, _variation = await _seed_admin(db_session)
    create = await authed_client.post("/v1/print-orders", json={"print_design_id": str(design.id)})
    order_id = create.json()["id"]
    # pending → done is allowed; done → pending is not.
    await authed_client.patch(f"/v1/print-orders/{order_id}", json={"status": "done"})
    bad = await authed_client.patch(f"/v1/print-orders/{order_id}", json={"status": "pending"})
    assert bad.status_code == 409


async def test_get_missing_404(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get(f"/v1/print-orders/{uuid.uuid4()}")
    assert response.status_code == 404


# ---------- complete ----------


async def test_complete_credits_printed_and_debits_paper(authed_client: AsyncClient, db_session):
    company, _user, design, variation = await _seed_admin(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, paper_type=PaperType.DTF_FILM)
    create = await authed_client.post(
        "/v1/print-orders",
        json={
            "print_design_id": str(design.id),
            "paper_roll_id": str(roll.id),
            "planned_outputs": [
                {"print_design_variation_id": str(variation.id), "side": "front", "planned_quantity": 10}
            ],
        },
    )
    order_id = create.json()["id"]
    await authed_client.patch(
        f"/v1/print-orders/{order_id}",
        json={
            "printed_outputs": [
                {"print_design_variation_id": str(variation.id), "side": "front", "printed_quantity": 10}
            ]
        },
    )
    completed = await authed_client.post(f"/v1/print-orders/{order_id}/complete", json={})
    assert completed.status_code == 200
    body = completed.json()
    assert body["status"] == "done"
    assert body["printed_at"] is not None
    assert body["total_printed"] == 10

    # Printed transfers credited downstream.
    levels = await authed_client.get("/v1/printed-transfers/levels", params={"print_design_id": str(design.id)})
    front = next(r for r in levels.json()["items"] if r["side"] == "front")
    assert front["on_hand"] == 10

    # Paper debited (0.35 * 10 = 3.5 m off 100).
    paper = await authed_client.get(f"/v1/paper-rolls/{roll.id}")
    assert float(paper.json()["current_meters"]) == 96.5


async def test_complete_idempotent(authed_client: AsyncClient, db_session):
    company, _user, design, variation = await _seed_admin(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, paper_type=PaperType.DTF_FILM)
    create = await authed_client.post(
        "/v1/print-orders",
        json={
            "print_design_id": str(design.id),
            "paper_roll_id": str(roll.id),
            "planned_outputs": [
                {"print_design_variation_id": str(variation.id), "side": "front", "planned_quantity": 10}
            ],
        },
    )
    order_id = create.json()["id"]
    await authed_client.patch(
        f"/v1/print-orders/{order_id}",
        json={
            "printed_outputs": [
                {"print_design_variation_id": str(variation.id), "side": "front", "printed_quantity": 10}
            ]
        },
    )
    await authed_client.post(f"/v1/print-orders/{order_id}/complete", json={})
    await authed_client.post(f"/v1/print-orders/{order_id}/complete", json={})
    # Still 10 (no double-credit) and paper unchanged from first complete.
    levels = await authed_client.get("/v1/printed-transfers/levels", params={"print_design_id": str(design.id)})
    front = next(r for r in levels.json()["items"] if r["side"] == "front")
    assert front["on_hand"] == 10
    paper = await authed_client.get(f"/v1/paper-rolls/{roll.id}")
    assert float(paper.json()["current_meters"]) == 96.5


# ---------- tenant isolation ----------


async def test_list_tenant_scoped(authed_client: AsyncClient, db_session):
    _company, _user, design, _variation = await _seed_admin(db_session)
    await authed_client.post("/v1/print-orders", json={"print_design_id": str(design.id)})
    other = await create_company(db_session)
    other_design = await create_print_design(db_session, company_id=other.id)
    other_user = await create_user(db_session, company_id=other.id)
    await print_order_service.create_print_order(
        db_session,
        company_id=other.id,
        user_id=other_user.id,
        payload=PrintOrderCreate(print_design_id=other_design.id),
    )
    response = await authed_client.get("/v1/print-orders")
    assert response.json()["total"] == 1
