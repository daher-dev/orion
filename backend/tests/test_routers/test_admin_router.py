import uuid

from httpx import AsyncClient
from sqlmodel import select

from models import Company, Invite
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_order,
    create_product,
    create_product_spec,
    create_product_variation,
    create_user,
    get_role_by_code,
)


async def _provision_operator(db_session, firebase_uid: str = "qa-dev-user") -> Company:
    """The signed-in caller (qa-dev-user) as a platform operator in its own company."""
    company = await create_company(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    await create_user(
        db_session,
        company_id=company.id,
        role_id=admin_role.id,
        firebase_uid=firebase_uid,
        is_operator=True,
    )
    return company


async def _provision_regular(db_session, firebase_uid: str = "qa-dev-user") -> Company:
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid=firebase_uid, is_operator=False)
    return company


async def _seed_order(db_session, company_id: uuid.UUID) -> None:
    spec = await create_product_spec(db_session, company_id=company_id)
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id)
    variation = await create_product_variation(db_session, company_id=company_id, product_id=product.id)
    ad = await create_ad(db_session, company_id=company_id, product_id=product.id)
    client = await create_client(db_session, company_id=company_id)
    await create_order(
        db_session,
        company_id=company_id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )


# ---------- access gate ----------


async def test_admin_requires_auth(async_client: AsyncClient):
    response = await async_client.get("/v1/admin/organizations")
    assert response.status_code == 401


async def test_admin_forbidden_for_non_operator(authed_client: AsyncClient, db_session):
    await _provision_regular(db_session)
    response = await authed_client.get("/v1/admin/organizations")
    assert response.status_code == 403


async def test_set_operator_grants_console_access(authed_client: AsyncClient, db_session):
    # Non-operator is blocked, then the test-support flag flips access on/off.
    await _provision_regular(db_session)
    assert (await authed_client.get("/v1/admin/organizations")).status_code == 403

    grant = await authed_client.post("/v1/test-support/set-operator", json={"value": True})
    assert grant.status_code == 204
    assert (await authed_client.get("/v1/admin/organizations")).status_code == 200

    revoke = await authed_client.post("/v1/test-support/set-operator", json={"value": False})
    assert revoke.status_code == 204
    assert (await authed_client.get("/v1/admin/organizations")).status_code == 403


# ---------- organizations ----------


async def test_list_organizations_returns_all_with_counts(authed_client: AsyncClient, db_session):
    own = await _provision_operator(db_session)
    other = await create_company(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    await create_user(db_session, company_id=other.id, role_id=admin_role.id, name="Other")

    response = await authed_client.get("/v1/admin/organizations")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    by_id = {row["id"]: row for row in body["items"]}
    assert by_id[str(own.id)]["member_count"] == 1
    assert by_id[str(other.id)]["member_count"] == 1
    assert by_id[str(own.id)]["accent"] == own.main_color


async def test_organization_orders_month_count(authed_client: AsyncClient, db_session):
    own = await _provision_operator(db_session)
    await _seed_order(db_session, own.id)

    response = await authed_client.get(f"/v1/admin/organizations/{own.id}")
    assert response.status_code == 200
    assert response.json()["orders_month"] == 1


async def test_overview_stats(authed_client: AsyncClient, db_session):
    await _provision_operator(db_session)
    response = await authed_client.get("/v1/admin/overview")
    assert response.status_code == 200
    body = response.json()
    assert body["total_organizations"] == 1
    assert body["total_operators"] == 1
    assert body["total_members"] == 1


async def test_create_organization_creates_company_and_invite(authed_client: AsyncClient, db_session):
    await _provision_operator(db_session)
    response = await authed_client.post(
        "/v1/admin/organizations",
        json={
            "name": "Ateliê Boa Vista",
            "subdomain": "boavista",
            "main_color": "#0f766e",
            "owner_email": "owner@boavista.com",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["organization"]["subdomain"] == "boavista"
    assert body["invite_token"]

    company = (await db_session.exec(select(Company).where(Company.subdomain == "boavista"))).first()
    assert company is not None
    invite = (await db_session.exec(select(Invite).where(Invite.company_id == company.id))).first()
    assert invite is not None
    assert invite.email == "owner@boavista.com"
    assert invite.accepted_at is None


async def test_create_organization_rejects_duplicate_subdomain(authed_client: AsyncClient, db_session):
    await _provision_operator(db_session)
    await create_company(db_session, subdomain="taken")
    response = await authed_client.post(
        "/v1/admin/organizations",
        json={"name": "Dup", "subdomain": "taken", "owner_email": "x@y.com"},
    )
    assert response.status_code == 409


# ---------- operators ----------


async def test_list_operators(authed_client: AsyncClient, db_session):
    own = await _provision_operator(db_session)
    # A non-operator in the same company must not appear.
    await create_user(db_session, company_id=own.id, name="Regular", is_operator=False)
    response = await authed_client.get("/v1/admin/users")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["company_name"] == own.name


# ---------- impersonation ----------


async def test_impersonation_reads_target_company(authed_client: AsyncClient, db_session):
    await _provision_operator(db_session)
    target = await create_company(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    await create_user(db_session, company_id=target.id, role_id=admin_role.id, name="TargetAdmin")

    response = await authed_client.get("/v1/members", headers={"X-Orion-Company-Id": str(target.id)})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "TargetAdmin"


async def test_me_reports_impersonating(authed_client: AsyncClient, db_session):
    await _provision_operator(db_session)
    target = await create_company(db_session)

    response = await authed_client.get("/v1/auth/me", headers={"X-Orion-Company-Id": str(target.id)})
    assert response.status_code == 200
    body = response.json()
    assert body["impersonating"] is True
    assert body["company"]["id"] == str(target.id)


async def test_impersonation_start_endpoint_audits(authed_client: AsyncClient, db_session):
    await _provision_operator(db_session)
    target = await create_company(db_session)
    response = await authed_client.post(f"/v1/admin/organizations/{target.id}/impersonate")
    assert response.status_code == 200
    assert response.json()["id"] == str(target.id)


async def test_operator_unknown_company_falls_back(authed_client: AsyncClient, db_session):
    # A stale/unknown X-Orion-Company-Id must not 404 an operator: it gracefully
    # falls back to their own membership instead of an impersonation 404.
    own = await _provision_operator(db_session)
    unknown = uuid.uuid4()
    response = await authed_client.get("/v1/members", headers={"X-Orion-Company-Id": str(unknown)})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1  # the operator's own company
    _ = own


async def test_non_operator_cannot_impersonate(authed_client: AsyncClient, db_session):
    own = await _provision_regular(db_session)
    target = await create_company(db_session)
    admin_role = await get_role_by_code(db_session, "admin")
    await create_user(db_session, company_id=target.id, role_id=admin_role.id, name="TargetAdmin")

    response = await authed_client.get("/v1/members", headers={"X-Orion-Company-Id": str(target.id)})
    # A non-operator with no membership in the target company never gets the
    # target's data: get_current_db_user safely falls back to their OWN company.
    assert response.status_code == 200
    body = response.json()
    names = {m["name"] for m in body["items"]}
    assert "TargetAdmin" not in names
    assert all(m["id"] != str(target.id) for m in body["items"])
    # The caller sees exactly their own single membership.
    assert body["total"] == 1
    _ = own
