import uuid

from sqlalchemy import func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Client
from schemas._common import PageParams
from schemas.client import ClientCreate, ClientFilters, ClientUpdate
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import NotFoundError


def _apply_filters(stmt, filters: ClientFilters):
    if filters.q:
        needle = f"%{filters.q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Client.name).like(needle),
                func.lower(Client.email).like(needle),
                func.lower(Client.phone).like(needle),
            )
        )
    return stmt


async def list_clients(
    db: AsyncSession,
    company_id: uuid.UUID,
    filters: ClientFilters,
    page: PageParams,
) -> tuple[list[Client], int]:
    base = scoped(select(Client), Client, company_id)
    base = _apply_filters(base, filters)

    count_stmt = scoped(select(func.count()).select_from(Client), Client, company_id)
    count_stmt = _apply_filters(count_stmt, filters)
    total_result = await db.exec(count_stmt)
    total = total_result.one()

    rows_stmt = (
        base.order_by(Client.created_at.desc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    rows_result = await db.exec(rows_stmt)
    return list(rows_result.all()), total


async def get_client(db: AsyncSession, company_id: uuid.UUID, client_id: uuid.UUID) -> Client:
    stmt = scoped(select(Client), Client, company_id).where(Client.id == client_id)
    result = await db.exec(stmt)
    client = result.first()
    if client is None:
        raise NotFoundError(detail="Client not found")
    return client


async def create_client(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: ClientCreate,
) -> Client:
    client = Client(
        company_id=company_id,
        name=payload.name,
        email=str(payload.email) if payload.email else None,
        phone=payload.phone,
        address=payload.address,
    )
    db.add(client)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="clients",
        resource_id=client.id,
        message=f"Created client {client.name}",
    )

    await db.commit()
    await db.refresh(client)
    return client


async def update_client(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    client_id: uuid.UUID,
    payload: ClientUpdate,
) -> Client:
    client = await get_client(db, company_id, client_id)
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if field == "email" and value is not None:
            value = str(value)
        setattr(client, field, value)
    db.add(client)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="clients",
        resource_id=client.id,
        message=f"Updated client {client.name}",
    )

    await db.commit()
    await db.refresh(client)
    return client


async def delete_client(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    client_id: uuid.UUID,
) -> None:
    client = await get_client(db, company_id, client_id)
    name = client.name
    await db.delete(client)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="clients",
        resource_id=client_id,
        message=f"Deleted client {name}",
    )

    await db.commit()
