"""Router tests for GET /v1/cutting/{order_id}/cost."""

import uuid
from decimal import Decimal

from httpx import AsyncClient

from models import CuttingStatus, Size
from schemas.cutting import CuttingUpdate
from services import cutting as cutting_service
from tests.factories import (
    create_company,
    create_cutting_order,
    create_cutting_order_output,
    create_fabric_roll,
    create_product_spec,
    create_user,
    get_role_by_code,
)


async def _seed_admin(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    return company, user


async def _done_order_with_cost(db_session, company_id):
    spec = await create_product_spec(db_session, company_id=company_id, code="CST01")
    body = await create_fabric_roll(db_session, company_id=company_id, price_per_kg=Decimal("38.00"))
    order = await create_cutting_order(
        db_session,
        company_id=company_id,
        spec_id=spec.id,
        body_roll_id=body.id,
        status=CuttingStatus.CUTTING,
    )
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=20)
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.G, quantity=10)
    return order


async def test_cost_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get(f"/v1/cutting/{uuid.uuid4()}/cost")
    assert response.status_code == 401


async def test_cost_200_after_done(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    order = await _done_order_with_cost(db_session, company.id)
    # Mark DONE through the API so the cost gets computed.
    patch = await authed_client.patch(f"/v1/cutting/{order.id}", json={"status": "done"})
    assert patch.status_code == 200

    response = await authed_client.get(f"/v1/cutting/{order.id}/cost")
    assert response.status_code == 200
    body = response.json()
    assert body["cutting_order_id"] == str(order.id)
    assert body["total_pieces"] == 30
    assert body["fabric_cost"] == 285.0
    assert body["labor_cost"] == 360.0
    assert body["total_cost"] == 645.0
    assert body["cost_per_piece"] == 21.5
    assert body["yield_pieces_per_kg"] == 4.0


async def test_cost_404_before_done(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    order = await _done_order_with_cost(db_session, company.id)
    # Still in CUTTING — no cost computed.
    response = await authed_client.get(f"/v1/cutting/{order.id}/cost")
    assert response.status_code == 404


async def test_cost_404_for_unknown_order(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get(f"/v1/cutting/{uuid.uuid4()}/cost")
    assert response.status_code == 404


async def test_cost_404_for_other_tenant_order(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    other = await create_company(db_session)
    other_user = await create_user(db_session, company_id=other.id)
    order = await _done_order_with_cost(db_session, other.id)
    # Compute the cost for the other tenant directly via the service.
    await cutting_service.update_cutting_order(
        db_session,
        company_id=other.id,
        user_id=other_user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )
    # The authed client (our company) must not see it → 404 (tenant scoped).
    response = await authed_client.get(f"/v1/cutting/{order.id}/cost")
    assert response.status_code == 404


async def test_cost_403_without_cutting_read(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    from models import Role

    role = Role(code=f"custom-no-cutting-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )
    order = await _done_order_with_cost(db_session, company.id)
    response = await authed_client.get(f"/v1/cutting/{order.id}/cost")
    assert response.status_code == 403


async def test_operator_can_read_cost(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=operator_role.id,
        firebase_uid="qa-dev-user",
    )
    order = await _done_order_with_cost(db_session, company.id)
    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )
    response = await authed_client.get(f"/v1/cutting/{order.id}/cost")
    assert response.status_code == 200
