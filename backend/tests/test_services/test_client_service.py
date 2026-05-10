import uuid

import pytest
from sqlmodel import select

from models import AuditLog, Client
from schemas._common import PageParams
from schemas.client import ClientCreate, ClientFilters, ClientUpdate
from services.client import (
    create_client,
    delete_client,
    get_client,
    list_clients,
    update_client,
)
from shared.exceptions import NotFoundError
from tests.factories import create_client as factory_create_client
from tests.factories import create_company, create_user


async def _setup(db_session, **company_kwargs):
    company = await create_company(db_session, **company_kwargs)
    user = await create_user(db_session, company_id=company.id)
    return company, user


async def test_create_client_persists_and_audits(db_session):
    company, user = await _setup(db_session)

    client = await create_client(
        db_session,
        company.id,
        user.id,
        ClientCreate(
            name="Mariana Costa",
            email="mariana@example.com",
            phone="+5511999990000",
            address="São Paulo, SP",
        ),
    )
    assert client.id is not None
    assert client.company_id == company.id
    assert client.email == "mariana@example.com"

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == client.id))).all()
    assert any("Created client Mariana Costa" in a.message for a in audits)


async def test_create_client_allows_optional_contact(db_session):
    company, user = await _setup(db_session)

    client = await create_client(
        db_session,
        company.id,
        user.id,
        ClientCreate(name="Walk-in"),
    )
    assert client.email is None
    assert client.phone is None
    assert client.address is None


async def test_get_client_happy_path(db_session):
    company, _ = await _setup(db_session)
    client = await factory_create_client(db_session, company_id=company.id, name="Bia")

    found = await get_client(db_session, company.id, client.id)
    assert found.id == client.id
    assert found.name == "Bia"


async def test_get_client_raises_not_found_for_missing(db_session):
    company, _ = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await get_client(db_session, company.id, uuid.uuid4())


async def test_get_client_does_not_leak_across_tenants(db_session):
    company_a, _ = await _setup(db_session)
    company_b = await create_company(db_session)
    other_client = await factory_create_client(db_session, company_id=company_b.id)

    with pytest.raises(NotFoundError):
        await get_client(db_session, company_a.id, other_client.id)


async def test_list_clients_returns_only_tenant_rows(db_session):
    company_a, _ = await _setup(db_session)
    company_b = await create_company(db_session)
    await factory_create_client(db_session, company_id=company_a.id, name="A1")
    await factory_create_client(db_session, company_id=company_a.id, name="A2")
    await factory_create_client(db_session, company_id=company_b.id, name="B1")

    rows, total = await list_clients(
        db_session,
        company_a.id,
        ClientFilters(),
        PageParams(),
    )
    assert total == 2
    assert {r.name for r in rows} == {"A1", "A2"}


async def test_list_clients_filters_by_search_text(db_session):
    company, _ = await _setup(db_session)
    await factory_create_client(
        db_session, company_id=company.id, name="Mariana Costa", email="m@example.com", phone="111"
    )
    await factory_create_client(
        db_session, company_id=company.id, name="Felipe Andrade", email="f@example.com", phone="222"
    )
    await factory_create_client(
        db_session, company_id=company.id, name="Beatriz Rocha", email="b@example.com", phone="333"
    )

    rows, total = await list_clients(
        db_session,
        company.id,
        ClientFilters(q="mariana"),
        PageParams(),
    )
    assert total == 1
    assert rows[0].name == "Mariana Costa"

    rows, total = await list_clients(
        db_session,
        company.id,
        ClientFilters(q="example.com"),
        PageParams(),
    )
    assert total == 3

    rows, total = await list_clients(
        db_session,
        company.id,
        ClientFilters(q="222"),
        PageParams(),
    )
    assert total == 1
    assert rows[0].name == "Felipe Andrade"


async def test_list_clients_paginates(db_session):
    company, _ = await _setup(db_session)
    for i in range(5):
        await factory_create_client(db_session, company_id=company.id, name=f"Client {i}")

    rows, total = await list_clients(
        db_session,
        company.id,
        ClientFilters(),
        PageParams(page=1, page_size=2),
    )
    assert total == 5
    assert len(rows) == 2

    rows_p3, _ = await list_clients(
        db_session,
        company.id,
        ClientFilters(),
        PageParams(page=3, page_size=2),
    )
    assert len(rows_p3) == 1


async def test_update_client_changes_fields_and_audits(db_session):
    company, user = await _setup(db_session)
    client = await factory_create_client(db_session, company_id=company.id, name="Old")

    updated = await update_client(
        db_session,
        company.id,
        user.id,
        client.id,
        ClientUpdate(name="New", email="new@example.com"),
    )
    assert updated.name == "New"
    assert updated.email == "new@example.com"

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == client.id))).all()
    assert any("Updated client New" in a.message for a in audits)


async def test_update_client_partial_keeps_other_fields(db_session):
    company, user = await _setup(db_session)
    client = await factory_create_client(db_session, company_id=company.id, name="Same", email="keep@example.com")

    updated = await update_client(
        db_session,
        company.id,
        user.id,
        client.id,
        ClientUpdate(phone="9999"),
    )
    assert updated.email == "keep@example.com"
    assert updated.phone == "9999"


async def test_update_client_raises_when_not_found(db_session):
    company, user = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await update_client(
            db_session,
            company.id,
            user.id,
            uuid.uuid4(),
            ClientUpdate(name="X"),
        )


async def test_update_client_does_not_cross_tenants(db_session):
    company_a, user_a = await _setup(db_session)
    company_b = await create_company(db_session)
    other = await factory_create_client(db_session, company_id=company_b.id)

    with pytest.raises(NotFoundError):
        await update_client(
            db_session,
            company_a.id,
            user_a.id,
            other.id,
            ClientUpdate(name="hacked"),
        )


async def test_delete_client_removes_row_and_audits(db_session):
    company, user = await _setup(db_session)
    client = await factory_create_client(db_session, company_id=company.id, name="Doomed")

    await delete_client(db_session, company.id, user.id, client.id)

    remaining = (await db_session.exec(select(Client).where(Client.id == client.id))).first()
    assert remaining is None

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == client.id))).all()
    assert any("Deleted client Doomed" in a.message for a in audits)


async def test_delete_client_raises_when_not_found(db_session):
    company, user = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await delete_client(db_session, company.id, user.id, uuid.uuid4())


async def test_delete_client_does_not_cross_tenants(db_session):
    company_a, user_a = await _setup(db_session)
    company_b = await create_company(db_session)
    other = await factory_create_client(db_session, company_id=company_b.id)

    with pytest.raises(NotFoundError):
        await delete_client(db_session, company_a.id, user_a.id, other.id)
