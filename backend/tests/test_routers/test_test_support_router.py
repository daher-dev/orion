"""Tests for the non-prod test-support reset endpoint."""

from httpx import AsyncClient
from sqlmodel import select

from models import Client, Company, User
from tests.factories import create_client, create_company, create_user


async def test_reset_truncates_data_but_keeps_auth_scaffold(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    await create_client(db_session, company_id=company.id, name="Mariana")

    # Sanity: the client row exists before reset.
    clients_before = (await db_session.exec(select(Client))).all()
    assert len(clients_before) >= 1

    response = await authed_client.post("/v1/test-support/reset")
    assert response.status_code == 204

    # Data table is wiped...
    clients_after = (await db_session.exec(select(Client))).all()
    assert clients_after == []

    # ...but the auth scaffold (companies, users) is preserved so the
    # bootstrapped identity keeps resolving across resets.
    companies_after = (await db_session.exec(select(Company))).all()
    users_after = (await db_session.exec(select(User))).all()
    assert len(companies_after) >= 1
    assert any(u.firebase_uid == "qa-dev-user" for u in users_after)


async def test_reset_is_idempotent(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")

    first = await authed_client.post("/v1/test-support/reset")
    assert first.status_code == 204
    # Running it again on already-clean data still succeeds.
    second = await authed_client.post("/v1/test-support/reset")
    assert second.status_code == 204


async def test_reset_requires_authentication(async_client: AsyncClient):
    response = await async_client.post("/v1/test-support/reset")
    assert response.status_code == 401
