"""HTTP integration tests for the Assembly (Montagem) router — T5.

Covers permission gating (401 unauth, 403 without perms, operator allowed),
the buildable read, the assemble status codes + stock effects, the on-hand
guard (409), and tenant isolation.
"""

import uuid

from httpx import AsyncClient

from models import BlankMovementKind, PrintedMovementKind, Role, Size
from tests.factories import (
    create_blank_piece,
    create_blank_piece_movement,
    create_company,
    create_print_design,
    create_printed_transfer,
    create_printed_transfer_movement,
    create_product_spec,
    create_user,
    get_role_by_code,
)


async def _seed_pair(db_session, *, company, blank_qty=10, printed_qty=10):
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01", name="Camiseta")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03", name="Floral")
    blank = await create_blank_piece(
        db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto", color_code="PRT"
    )
    if blank_qty:
        await create_blank_piece_movement(
            db_session, company_id=company.id, blank_piece_id=blank.id, kind=BlankMovementKind.ENTRY, quantity=blank_qty
        )
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    if printed_qty:
        await create_printed_transfer_movement(
            db_session,
            company_id=company.id,
            printed_transfer_id=transfer.id,
            kind=PrintedMovementKind.ENTRY,
            quantity=printed_qty,
        )
    return spec, design, blank, transfer


async def _seed_admin(db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    return company


async def _seed_operator(db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    await create_user(db_session, company_id=company.id, role_id=operator_role.id, firebase_uid="qa-dev-user")
    return company


async def _seed_no_permission(db_session):
    company = await create_company(db_session)
    role = Role(code=f"custom-no-asm-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="qa-dev-user")
    return company


# ---------- auth ----------


async def test_buildable_unauthenticated_401(async_client: AsyncClient):
    response = await async_client.get("/v1/assembly/buildable")
    assert response.status_code == 401


async def test_buildable_forbidden_without_permission(authed_client: AsyncClient, db_session):
    await _seed_no_permission(db_session)
    response = await authed_client.get("/v1/assembly/buildable")
    assert response.status_code == 403


async def test_operator_can_assemble(authed_client: AsyncClient, db_session):
    company = await _seed_operator(db_session)
    _spec, _design, blank, transfer = await _seed_pair(db_session, company=company)
    response = await authed_client.post(
        "/v1/assembly",
        json={"blank_piece_id": str(blank.id), "printed_transfer_id": str(transfer.id), "quantity": 3},
    )
    assert response.status_code == 201


# ---------- buildable ----------


async def test_buildable_lists_pair(authed_client: AsyncClient, db_session):
    company = await _seed_admin(db_session)
    _spec, _design, _blank, _transfer = await _seed_pair(db_session, company=company, blank_qty=7, printed_qty=4)
    response = await authed_client.get("/v1/assembly/buildable")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    row = body["items"][0]
    assert row["max_buildable"] == 4
    assert row["sku"] == "CAM01-M-PRT-FLR03"


# ---------- assemble ----------


async def test_assemble_credits_finished_debits_components(authed_client: AsyncClient, db_session):
    company = await _seed_admin(db_session)
    _spec, design, blank, transfer = await _seed_pair(db_session, company=company)
    response = await authed_client.post(
        "/v1/assembly",
        json={"blank_piece_id": str(blank.id), "printed_transfer_id": str(transfer.id), "quantity": 6},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["created_new_variation"] is True
    assert body["sku"] == "CAM01-M-PRT-FLR03"

    # Finished SKU is order-ready in /stock.
    stock = await authed_client.get("/v1/stock/levels")
    row = next(r for r in stock.json()["items"] if r["sku"] == "CAM01-M-PRT-FLR03")
    assert row["on_hand"] == 6

    # Components debited.
    blank_levels = await authed_client.get("/v1/blank-stock/levels")
    blank_row = next(r for r in blank_levels.json()["items"] if r["color_code"] == "PRT")
    assert blank_row["on_hand"] == 4
    printed_levels = await authed_client.get("/v1/printed-transfers/levels")
    printed_row = next(r for r in printed_levels.json()["items"] if r["print_design_id"] == str(design.id))
    assert printed_row["on_hand"] == 4


async def test_assemble_beyond_available_409(authed_client: AsyncClient, db_session):
    company = await _seed_admin(db_session)
    _spec, _design, blank, transfer = await _seed_pair(db_session, company=company, blank_qty=10, printed_qty=2)
    response = await authed_client.post(
        "/v1/assembly",
        json={"blank_piece_id": str(blank.id), "printed_transfer_id": str(transfer.id), "quantity": 5},
    )
    assert response.status_code == 409


async def test_assemble_missing_blank_404(authed_client: AsyncClient, db_session):
    company = await _seed_admin(db_session)
    _spec, _design, _blank, transfer = await _seed_pair(db_session, company=company)
    response = await authed_client.post(
        "/v1/assembly",
        json={"blank_piece_id": str(uuid.uuid4()), "printed_transfer_id": str(transfer.id), "quantity": 1},
    )
    assert response.status_code == 404


# ---------- tenant isolation ----------


async def test_buildable_tenant_scoped(authed_client: AsyncClient, db_session):
    company = await _seed_admin(db_session)
    await _seed_pair(db_session, company=company)
    other = await create_company(db_session)
    await _seed_pair(db_session, company=other)
    response = await authed_client.get("/v1/assembly/buildable")
    assert response.json()["total"] == 1
