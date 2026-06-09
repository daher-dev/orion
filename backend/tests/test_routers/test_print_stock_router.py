"""HTTP integration tests for the Print Stock router.

Covers permission gating, tenant isolation, validation, pagination, filters,
and the negative-stock guard.
"""

import uuid

from httpx import AsyncClient
from sqlmodel import select

from models import PrintStockDirection, PrintStockMovement, Role
from tests.factories import (
    create_company,
    create_print_design,
    create_print_stock_movement,
    create_user,
    get_role_by_code,
)


async def _seed_admin(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    return company, user


async def _seed_operator(db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(db_session, company_id=company.id, role_id=operator_role.id, firebase_uid="qa-dev-user")
    return company, user


async def _seed_no_perm(db_session):
    company = await create_company(db_session)
    role = Role(code=f"custom-no-pstock-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="qa-dev-user")
    return company


# ---------- auth ----------


async def test_levels_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/print-stock/levels")
    assert response.status_code == 401


async def test_create_entry_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.post(
        "/v1/print-stock/entries",
        json={"print_design_id": str(uuid.uuid4()), "product_color": "Preto", "quantity": 1},
    )
    assert response.status_code == 401


async def test_levels_forbidden_without_read(authed_client: AsyncClient, db_session):
    await _seed_no_perm(db_session)
    response = await authed_client.get("/v1/print-stock/levels")
    assert response.status_code == 403


async def test_create_entry_forbidden_without_write(authed_client: AsyncClient, db_session):
    await _seed_no_perm(db_session)
    response = await authed_client.post(
        "/v1/print-stock/entries",
        json={"print_design_id": str(uuid.uuid4()), "product_color": "Preto", "quantity": 1},
    )
    assert response.status_code == 403


# ---------- GET /levels ----------


async def test_levels_empty(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get("/v1/print-stock/levels")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_levels_returns_on_hand_aggregate(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    design = await create_print_design(db_session, company_id=company.id, code="EST01")
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, product_color="Preto", quantity=15
    )
    await create_print_stock_movement(
        db_session,
        company_id=company.id,
        print_design_id=design.id,
        product_color="Preto",
        direction=PrintStockDirection.EXIT,
        quantity=4,
    )
    response = await authed_client.get("/v1/print-stock/levels")
    body = response.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["product_color"] == "Preto"
    assert item["on_hand"] == 11
    assert item["entries_total"] == 15
    assert item["exits_total"] == 4
    assert item["design"]["code"] == "EST01"


async def test_levels_tenant_isolation(authed_client: AsyncClient, db_session):
    company_a, _ = await _seed_admin(db_session)
    company_b = await create_company(db_session)
    design_a = await create_print_design(db_session, company_id=company_a.id, code="MINE")
    design_b = await create_print_design(db_session, company_id=company_b.id, code="THEIRS")
    await create_print_stock_movement(db_session, company_id=company_a.id, print_design_id=design_a.id, quantity=1)
    await create_print_stock_movement(db_session, company_id=company_b.id, print_design_id=design_b.id, quantity=1)
    response = await authed_client.get("/v1/print-stock/levels")
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["design"]["code"] == "MINE"


async def test_levels_pagination(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    for i in range(3):
        design = await create_print_design(db_session, company_id=company.id, code=f"E{i}")
        await create_print_stock_movement(db_session, company_id=company.id, print_design_id=design.id, quantity=1)
    response = await authed_client.get("/v1/print-stock/levels", params={"page_size": 2})
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["has_more"] is True


# ---------- GET /movements ----------


async def test_movements_returns_ledger_and_filters_direction(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, direction=PrintStockDirection.ENTRY, quantity=10
    )
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, direction=PrintStockDirection.EXIT, quantity=2
    )
    response = await authed_client.get("/v1/print-stock/movements")
    body = response.json()
    assert body["total"] == 2

    response = await authed_client.get("/v1/print-stock/movements", params={"direction": "exit"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["direction"] == "exit"


# ---------- POST /entries ----------


async def test_create_entry_success(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/print-stock/entries",
        json={"print_design_id": str(design.id), "product_color": "Preto", "quantity": 12, "notes": "run"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["direction"] == "entry"
    assert body["quantity"] == 12
    assert body["product_color"] == "Preto"

    rows = (
        await db_session.exec(select(PrintStockMovement).where(PrintStockMovement.print_design_id == design.id))
    ).all()
    assert len(list(rows)) == 1


async def test_create_entry_invalid_quantity_returns_422(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/print-stock/entries",
        json={"print_design_id": str(design.id), "product_color": "Preto", "quantity": 0},
    )
    assert response.status_code == 422


async def test_create_entry_unknown_design_returns_404(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post(
        "/v1/print-stock/entries",
        json={"print_design_id": str(uuid.uuid4()), "product_color": "Preto", "quantity": 1},
    )
    assert response.status_code == 404


async def test_create_entry_other_tenant_design_returns_404(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    other = await create_company(db_session)
    foreign = await create_print_design(db_session, company_id=other.id)
    response = await authed_client.post(
        "/v1/print-stock/entries",
        json={"print_design_id": str(foreign.id), "product_color": "Preto", "quantity": 1},
    )
    assert response.status_code == 404


async def test_operator_can_create_entry(authed_client: AsyncClient, db_session):
    company, _ = await _seed_operator(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    response = await authed_client.post(
        "/v1/print-stock/entries",
        json={"print_design_id": str(design.id), "product_color": "Preto", "quantity": 3},
    )
    assert response.status_code == 201


# ---------- POST /exits ----------


async def test_create_exit_success(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, product_color="Preto", quantity=10
    )
    response = await authed_client.post(
        "/v1/print-stock/exits",
        json={"print_design_id": str(design.id), "product_color": "Preto", "quantity": 4},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["direction"] == "exit"
    assert body["quantity"] == 4


async def test_create_exit_below_zero_returns_409(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, product_color="Preto", quantity=3
    )
    response = await authed_client.post(
        "/v1/print-stock/exits",
        json={"print_design_id": str(design.id), "product_color": "Preto", "quantity": 10},
    )
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert "insufficient" in detail.lower()
    assert "3" in detail


async def test_operator_can_create_exit(authed_client: AsyncClient, db_session):
    company, _ = await _seed_operator(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    await create_print_stock_movement(
        db_session, company_id=company.id, print_design_id=design.id, product_color="Preto", quantity=5
    )
    response = await authed_client.post(
        "/v1/print-stock/exits",
        json={"print_design_id": str(design.id), "product_color": "Preto", "quantity": 2},
    )
    assert response.status_code == 201
