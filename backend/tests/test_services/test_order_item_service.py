import pytest
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from models import OrderItem, SeparationStatus
from services.order_item import list_order_items
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_order,
    create_order_item,
    create_product,
    create_product_spec,
    create_product_variation,
    create_user,
)


async def _order(db, *, company_id):
    spec = await create_product_spec(db, company_id=company_id)
    product = await create_product(db, company_id=company_id, spec_id=spec.id)
    variation = await create_product_variation(db, company_id=company_id, product_id=product.id)
    ad = await create_ad(db, company_id=company_id, product_id=product.id)
    client = await create_client(db, company_id=company_id)
    order = await create_order(db, company_id=company_id, ad_id=ad.id, variation_id=variation.id, client_id=client.id)
    return order, variation


async def test_list_order_items_scoped_and_ordered(db_session):
    company = await create_company(db_session)
    order, _ = await _order(db_session, company_id=company.id)
    await create_order_item(db_session, company_id=company.id, order_id=order.id, item_index=2, tracking_code="T2")
    await create_order_item(db_session, company_id=company.id, order_id=order.id, item_index=1, tracking_code="T1")

    items = await list_order_items(db_session, company_id=company.id, order_id=order.id)
    assert [i.item_index for i in items] == [1, 2]


async def test_list_order_items_other_tenant_empty(db_session):
    company = await create_company(db_session)
    other = await create_company(db_session)
    order, _ = await _order(db_session, company_id=company.id)
    await create_order_item(db_session, company_id=company.id, order_id=order.id)

    assert await list_order_items(db_session, company_id=other.id, order_id=order.id) == []


async def test_order_item_resolves_variation_and_print(db_session):
    company = await create_company(db_session)
    order, variation = await _order(db_session, company_id=company.id)
    item = await create_order_item(
        db_session,
        company_id=company.id,
        order_id=order.id,
        variation_id=variation.id,
        mapped_print="Cristo Redentor",
        status=SeparationStatus.CHECKED,
        checked_by="picker@example.com",
    )
    assert item.variation_id == variation.id
    assert item.mapped_print == "Cristo Redentor"
    assert item.status == SeparationStatus.CHECKED


async def test_order_item_cascade_on_order_delete(db_session):
    company = await create_company(db_session)
    order, _ = await _order(db_session, company_id=company.id)
    await create_order_item(db_session, company_id=company.id, order_id=order.id)

    await db_session.delete(order)
    await db_session.commit()

    remaining = (await db_session.exec(select(OrderItem).where(OrderItem.order_id == order.id))).all()
    assert remaining == []


async def test_order_item_tracking_code_unique_per_company(db_session):
    company = await create_company(db_session)
    order, _ = await _order(db_session, company_id=company.id)
    await create_order_item(db_session, company_id=company.id, order_id=order.id, tracking_code="DUP")

    with pytest.raises(IntegrityError):
        await create_order_item(db_session, company_id=company.id, order_id=order.id, tracking_code="DUP")
    await db_session.rollback()


async def test_order_item_null_tracking_codes_allowed(db_session):
    company = await create_company(db_session)
    order, _ = await _order(db_session, company_id=company.id)
    await create_order_item(db_session, company_id=company.id, order_id=order.id, tracking_code=None)
    await create_order_item(db_session, company_id=company.id, order_id=order.id, tracking_code=None)

    items = await list_order_items(db_session, company_id=company.id, order_id=order.id)
    assert len(items) == 2
    assert all(i.status == SeparationStatus.PENDING for i in items)


async def test_list_order_items_endpoint(authed_client: AsyncClient, db_session):
    company = await create_company(db_session)
    await create_user(db_session, company_id=company.id, firebase_uid="qa-dev-user")
    order, _ = await _order(db_session, company_id=company.id)
    await create_order_item(db_session, company_id=company.id, order_id=order.id, item_index=0, tracking_code="QR-1")

    response = await authed_client.get(f"/v1/orders/{order.id}/items")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["tracking_code"] == "QR-1"
    assert body[0]["status"] == "pending"
