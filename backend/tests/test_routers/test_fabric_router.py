import uuid
from datetime import date
from decimal import Decimal

from httpx import AsyncClient
from sqlmodel import select

from models import FabricRoll, FabricRollKind, FabricType
from tests.factories import (
    create_company,
    create_cutting_order,
    create_fabric_roll,
    create_product_spec,
    create_user,
    get_role_by_code,
)

# ---------- helpers ----------


def _payload_dict(**overrides) -> dict:
    base = {
        "received_at": "2026-05-01",
        "supplier_name": "Malharia Estrela",
        "kind": "body",
        "fabric_type": "jersey",
        "initial_weight_kg": "25.000",
        "color": "Off-white",
        "price_per_kg": "38.00",
    }
    base.update(overrides)
    return base


async def _seed_admin(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    return company, user


async def _seed_operator(db_session):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(
        db_session,
        company_id=company.id,
        role_id=operator_role.id,
        firebase_uid="qa-dev-user",
    )
    return company, user


# ---------- auth ----------


async def test_list_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.get("/v1/fabric")
    assert response.status_code == 401


async def test_create_unauthenticated_returns_401(async_client: AsyncClient):
    response = await async_client.post("/v1/fabric", json=_payload_dict())
    assert response.status_code == 401


# ---------- GET / ----------


async def test_list_returns_empty_page_for_new_tenant(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get("/v1/fabric")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0
    assert body["page"] == 1
    assert body["has_more"] is False


async def test_list_returns_tenant_rows(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    await create_fabric_roll(db_session, company_id=company.id, supplier_name="A")
    await create_fabric_roll(db_session, company_id=company.id, supplier_name="B")

    response = await authed_client.get("/v1/fabric")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    suppliers = {item["supplier_name"] for item in body["items"]}
    assert suppliers == {"A", "B"}
    # consumed_kg is part of every read payload.
    for item in body["items"]:
        assert "consumed_kg" in item


async def test_list_filters_by_search(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    await create_fabric_roll(db_session, company_id=company.id, supplier_name="Têxtil Norte")
    await create_fabric_roll(db_session, company_id=company.id, supplier_name="Malharia Estrela")

    response = await authed_client.get("/v1/fabric", params={"q": "estrela"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["supplier_name"] == "Malharia Estrela"


async def test_list_filters_by_kind(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    await create_fabric_roll(db_session, company_id=company.id, kind=FabricRollKind.BODY)
    await create_fabric_roll(db_session, company_id=company.id, kind=FabricRollKind.RIB)

    response = await authed_client.get("/v1/fabric", params={"kind": "rib"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["kind"] == "rib"


async def test_list_filters_by_fabric_type(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    await create_fabric_roll(db_session, company_id=company.id, fabric_type=FabricType.JERSEY)
    await create_fabric_roll(db_session, company_id=company.id, fabric_type=FabricType.FLEECE)

    response = await authed_client.get("/v1/fabric", params={"fabric_type": "fleece"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["fabric_type"] == "fleece"


async def test_list_pagination(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    for _ in range(3):
        await create_fabric_roll(db_session, company_id=company.id)

    response = await authed_client.get("/v1/fabric", params={"page_size": 2})
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["has_more"] is True


async def test_list_does_not_leak_other_tenants(authed_client: AsyncClient, db_session):
    company_a, _ = await _seed_admin(db_session)
    company_b = await create_company(db_session)
    await create_fabric_roll(db_session, company_id=company_a.id, supplier_name="Mine")
    await create_fabric_roll(db_session, company_id=company_b.id, supplier_name="Theirs")

    response = await authed_client.get("/v1/fabric")
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["supplier_name"] == "Mine"


async def test_list_forbidden_when_no_permission(authed_client: AsyncClient, db_session):
    """A user attached to a role with no `fabric.*` permission receives 403."""
    company = await create_company(db_session)
    # Build a brand-new bare role with no permissions and attach the user to it.
    # Use a uuid-suffixed code because the conftest preserves the roles table.
    from models import Role

    role = Role(code=f"custom-no-fabric-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)

    await create_user(
        db_session,
        company_id=company.id,
        role_id=role.id,
        firebase_uid="qa-dev-user",
    )
    response = await authed_client.get("/v1/fabric")
    assert response.status_code == 403


# ---------- GET /{id} ----------


async def test_get_returns_roll(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    seed = await create_fabric_roll(
        db_session,
        company_id=company.id,
        initial_weight_kg=Decimal("20.000"),
        current_weight_kg=Decimal("12.000"),
    )

    response = await authed_client.get(f"/v1/fabric/{seed.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(seed.id)
    assert body["initial_weight_kg"] == "20.000"
    assert body["current_weight_kg"] == "12.000"
    assert body["consumed_kg"] == "8.000"


async def test_get_returns_404_when_unknown(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.get(f"/v1/fabric/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_get_returns_404_for_other_tenant_row(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    other = await create_company(db_session)
    foreign = await create_fabric_roll(db_session, company_id=other.id)

    response = await authed_client.get(f"/v1/fabric/{foreign.id}")
    assert response.status_code == 404


# ---------- POST / ----------


async def test_create_success(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    response = await authed_client.post("/v1/fabric", json=_payload_dict())
    assert response.status_code == 201
    body = response.json()
    assert body["supplier_name"] == "Malharia Estrela"
    assert body["kind"] == "body"
    assert body["fabric_type"] == "jersey"
    # Default current = initial when omitted.
    assert body["current_weight_kg"] == "25.000"
    assert body["initial_weight_kg"] == "25.000"
    assert body["consumed_kg"] == "0.000"

    rows = (await db_session.exec(select(FabricRoll).where(FabricRoll.company_id == company.id))).all()
    assert len(list(rows)) == 1


async def test_create_uses_provided_current_weight(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    payload = _payload_dict(initial_weight_kg="30.000", current_weight_kg="20.000")
    response = await authed_client.post("/v1/fabric", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["initial_weight_kg"] == "30.000"
    assert body["current_weight_kg"] == "20.000"


async def test_create_returns_409_when_current_exceeds_initial(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    payload = _payload_dict(initial_weight_kg="10.000", current_weight_kg="12.000")
    response = await authed_client.post("/v1/fabric", json=payload)
    assert response.status_code == 409
    assert "exceed" in response.json()["detail"].lower()


async def test_create_returns_422_for_invalid_payload(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.post("/v1/fabric", json=_payload_dict(initial_weight_kg="0.000"))
    assert response.status_code == 422


async def test_create_forbidden_for_operator(authed_client: AsyncClient, db_session):
    await _seed_operator(db_session)
    response = await authed_client.post("/v1/fabric", json=_payload_dict())
    assert response.status_code == 403


# ---------- PATCH /{id} ----------


async def test_patch_updates_fields(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    seed = await create_fabric_roll(
        db_session,
        company_id=company.id,
        initial_weight_kg=Decimal("20.000"),
        current_weight_kg=Decimal("20.000"),
    )

    response = await authed_client.patch(
        f"/v1/fabric/{seed.id}",
        json={"current_weight_kg": "15.500", "price_per_kg": "42.00"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["current_weight_kg"] == "15.500"
    assert body["price_per_kg"] == "42.00"
    assert body["consumed_kg"] == "4.500"


async def test_patch_returns_404_when_unknown(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.patch(
        f"/v1/fabric/{uuid.uuid4()}",
        json={"current_weight_kg": "1.000"},
    )
    assert response.status_code == 404


async def test_patch_returns_409_when_current_exceeds_initial(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    seed = await create_fabric_roll(
        db_session,
        company_id=company.id,
        initial_weight_kg=Decimal("10.000"),
        current_weight_kg=Decimal("10.000"),
    )

    response = await authed_client.patch(
        f"/v1/fabric/{seed.id}",
        json={"current_weight_kg": "11.000"},
    )
    assert response.status_code == 409


async def test_patch_returns_422_for_invalid_payload(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    seed = await create_fabric_roll(db_session, company_id=company.id)
    response = await authed_client.patch(
        f"/v1/fabric/{seed.id}",
        json={"initial_weight_kg": "0.000"},
    )
    assert response.status_code == 422


async def test_patch_forbidden_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _seed_operator(db_session)
    seed = await create_fabric_roll(db_session, company_id=company.id)
    response = await authed_client.patch(
        f"/v1/fabric/{seed.id}",
        json={"current_weight_kg": "1.000"},
    )
    assert response.status_code == 403


# ---------- DELETE /{id} ----------


async def test_delete_returns_204(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    seed = await create_fabric_roll(db_session, company_id=company.id)

    response = await authed_client.delete(f"/v1/fabric/{seed.id}")
    assert response.status_code == 204

    rows = (await db_session.exec(select(FabricRoll).where(FabricRoll.id == seed.id))).all()
    assert list(rows) == []


async def test_delete_returns_404_when_unknown(authed_client: AsyncClient, db_session):
    await _seed_admin(db_session)
    response = await authed_client.delete(f"/v1/fabric/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_delete_returns_409_when_linked_to_cutting_order(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    roll = await create_fabric_roll(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=roll.id,
    )

    response = await authed_client.delete(f"/v1/fabric/{roll.id}")
    assert response.status_code == 409
    assert "referenced" in response.json()["detail"].lower()


async def test_delete_forbidden_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _seed_operator(db_session)
    seed = await create_fabric_roll(db_session, company_id=company.id)
    response = await authed_client.delete(f"/v1/fabric/{seed.id}")
    assert response.status_code == 403


# ---------- Operator read-only access ----------


async def test_operator_can_list(authed_client: AsyncClient, db_session):
    company, _ = await _seed_operator(db_session)
    await create_fabric_roll(db_session, company_id=company.id)
    response = await authed_client.get("/v1/fabric")
    # Operator role has fabric.read per seed migration.
    assert response.status_code == 200


async def test_operator_can_get_detail(authed_client: AsyncClient, db_session):
    company, _ = await _seed_operator(db_session)
    seed = await create_fabric_roll(db_session, company_id=company.id)
    response = await authed_client.get(f"/v1/fabric/{seed.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(seed.id)


# Pin reference type usage so flake8/ruff don't strip imports.
_ = (date,)


# ---------- movements (GET/POST /v1/fabric/movements) ----------


async def test_movements_post_and_list(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    roll = await create_fabric_roll(db_session, company_id=company.id, current_weight_kg=Decimal("10.000"))

    post = await authed_client.post(
        "/v1/fabric/movements",
        json={"fabric_roll_id": str(roll.id), "kind": "entry", "quantity": "4.000"},
    )
    assert post.status_code == 201, post.text
    created = post.json()
    assert created["kind"] == "entry"
    assert created["cutting_order_id"] is None

    listing = await authed_client.get("/v1/fabric/movements")
    assert listing.status_code == 200
    body = listing.json()
    assert body["total"] == 1
    assert body["items"][0]["fabric_roll"]["id"] == str(roll.id)

    # current_meters credited.
    roll_resp = await authed_client.get(f"/v1/fabric/{roll.id}")
    assert roll_resp.json()["current_weight_kg"] == "14.000"


async def test_movements_filter_by_roll(authed_client: AsyncClient, db_session):
    company, _ = await _seed_admin(db_session)
    roll = await create_fabric_roll(db_session, company_id=company.id)
    other = await create_fabric_roll(db_session, company_id=company.id)
    for target in (roll, other):
        await authed_client.post(
            "/v1/fabric/movements",
            json={"fabric_roll_id": str(target.id), "kind": "entry", "quantity": "1.000"},
        )

    resp = await authed_client.get("/v1/fabric/movements", params={"fabric_roll_id": str(roll.id)})
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["fabric_roll_id"] == str(roll.id)


async def test_movements_post_forbidden_for_no_permission(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    from models import Role

    role = Role(code=f"custom-no-fabric-{uuid.uuid4().hex[:8]}", name="Custom")
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    await create_user(db_session, company_id=company.id, role_id=role.id, firebase_uid="qa-dev-user")
    response = await authed_client.post(
        "/v1/fabric/movements",
        json={"fabric_roll_id": str(uuid.uuid4()), "kind": "entry", "quantity": "1.000"},
    )
    assert response.status_code == 403


async def test_movements_route_not_shadowed_by_roll_matcher(authed_client: AsyncClient, db_session):
    """GET /fabric/movements must hit the ledger, not the /{roll_id} matcher."""

    await _seed_admin(db_session)
    resp = await authed_client.get("/v1/fabric/movements")
    assert resp.status_code == 200
    assert "items" in resp.json()
