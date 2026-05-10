import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from dependencies import DbSession, RequirePermission
from models import User
from schemas._common import PageParams
from schemas.client import ClientCreate, ClientFilters, ClientPage, ClientRead, ClientUpdate
from services.client import (
    create_client,
    delete_client,
    get_client,
    list_clients,
    update_client,
)

router = APIRouter(
    prefix="/clients",
    tags=["clients"],
    dependencies=[Depends(RequirePermission("clients.read"))],
)


def _to_read(client) -> ClientRead:
    return ClientRead.model_validate(client, from_attributes=True)


@router.get("", response_model=ClientPage)
async def list_clients_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("clients.read"))],
    q: Annotated[str | None, Query(max_length=120)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> ClientPage:
    filters = ClientFilters(q=q)
    params = PageParams(page=page, page_size=page_size)
    rows, total = await list_clients(db, user.company_id, filters, params)
    return ClientPage.build([_to_read(r) for r in rows], total, params)


@router.get("/{client_id}", response_model=ClientRead)
async def get_client_endpoint(
    client_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("clients.read"))],
) -> ClientRead:
    client = await get_client(db, user.company_id, client_id)
    return _to_read(client)


@router.post("", response_model=ClientRead, status_code=status.HTTP_201_CREATED)
async def create_client_endpoint(
    payload: ClientCreate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("clients.write"))],
) -> ClientRead:
    client = await create_client(db, user.company_id, user.id, payload)
    return _to_read(client)


@router.patch("/{client_id}", response_model=ClientRead)
async def update_client_endpoint(
    client_id: uuid.UUID,
    payload: ClientUpdate,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("clients.write"))],
) -> ClientRead:
    client = await update_client(db, user.company_id, user.id, client_id, payload)
    return _to_read(client)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client_endpoint(
    client_id: uuid.UUID,
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("clients.write"))],
) -> None:
    await delete_client(db, user.company_id, user.id, client_id)
