"""Phase 6 — Order readiness flags surfaced on the orders read (T6 board).

``ready`` (finished stock covers the full quantity), ``on_hand`` (finished
on-hand for the order's variation), and ``has_unmapped_items`` (≥1 OrderItem with
variation_id NULL) are computed no-N+1 in ``order.list_orders`` / ``order.get_order``
and drive the Pedidos board's stage bucketing.
"""

from dataclasses import dataclass

from sqlmodel import select

from models import OrderItem, SeparationStatus, Size
from schemas._common import PageParams
from schemas.order import OrderFilters
from services import order as order_service
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_order_item,
    create_print_design,
    create_product,
    create_product_spec,
    create_product_variation,
    create_stock_entry,
    create_user,
)
from tests.factories import (
    create_order as factory_create_order,
)


@dataclass(slots=True)
class _Scene:
    company: object
    user: object
    variation: object
    client: object
    ad: object


async def _scaffold(db_session) -> _Scene:
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id, print_id=design.id)
    variation = await create_product_variation(
        db_session, company_id=company.id, product_id=product.id, size=Size.M, color="Preto", color_code="BLK"
    )
    client = await create_client(db_session, company_id=company.id)
    ad = await create_ad(db_session, company_id=company.id, product_id=product.id)
    return _Scene(company=company, user=user, variation=variation, client=client, ad=ad)


async def test_get_order_ready_when_stock_covers(db_session):
    scene = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=scene.company.id,
        ad_id=scene.ad.id,
        variation_id=scene.variation.id,
        client_id=scene.client.id,
        quantity=3,
    )
    await create_stock_entry(db_session, company_id=scene.company.id, variation_id=scene.variation.id, quantity=5)

    _row, readiness = await order_service.get_order(db_session, company_id=scene.company.id, order_id=order.id)
    assert readiness.ready is True
    assert readiness.on_hand == 5
    assert readiness.has_unmapped_items is False


async def test_get_order_not_ready_when_stock_short(db_session):
    scene = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=scene.company.id,
        ad_id=scene.ad.id,
        variation_id=scene.variation.id,
        client_id=scene.client.id,
        quantity=4,
    )
    await create_stock_entry(db_session, company_id=scene.company.id, variation_id=scene.variation.id, quantity=2)

    _row, readiness = await order_service.get_order(db_session, company_id=scene.company.id, order_id=order.id)
    assert readiness.ready is False
    assert readiness.on_hand == 2


async def test_get_order_no_stock_history_not_ready(db_session):
    scene = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=scene.company.id,
        ad_id=scene.ad.id,
        variation_id=scene.variation.id,
        client_id=scene.client.id,
        quantity=1,
    )
    _row, readiness = await order_service.get_order(db_session, company_id=scene.company.id, order_id=order.id)
    assert readiness.ready is False
    assert readiness.on_hand == 0


async def test_has_unmapped_items_flag(db_session):
    scene = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=scene.company.id,
        ad_id=scene.ad.id,
        variation_id=scene.variation.id,
        client_id=scene.client.id,
        quantity=2,
    )
    # One unmapped piece (variation_id NULL) blocks Separação.
    await create_order_item(
        db_session, company_id=scene.company.id, order_id=order.id, variation_id=None, status=SeparationStatus.PENDING
    )
    _row, readiness = await order_service.get_order(db_session, company_id=scene.company.id, order_id=order.id)
    assert readiness.has_unmapped_items is True

    # Map the piece → flag clears.
    piece = (await db_session.exec(select(OrderItem).where(OrderItem.order_id == order.id))).first()
    piece.variation_id = scene.variation.id
    db_session.add(piece)
    await db_session.commit()
    _row, readiness2 = await order_service.get_order(db_session, company_id=scene.company.id, order_id=order.id)
    assert readiness2.has_unmapped_items is False


async def test_list_orders_readiness_map_no_n_plus_1(db_session):
    scene = await _scaffold(db_session)
    o_ready = await factory_create_order(
        db_session,
        company_id=scene.company.id,
        ad_id=scene.ad.id,
        variation_id=scene.variation.id,
        client_id=scene.client.id,
        quantity=2,
        external_order_id="A1",
    )
    o_short = await factory_create_order(
        db_session,
        company_id=scene.company.id,
        ad_id=scene.ad.id,
        variation_id=scene.variation.id,
        client_id=scene.client.id,
        quantity=10,
        external_order_id="A2",
    )
    await create_stock_entry(db_session, company_id=scene.company.id, variation_id=scene.variation.id, quantity=3)

    _rows, total, readiness = await order_service.list_orders(
        db_session, company_id=scene.company.id, filters=OrderFilters(), page=PageParams()
    )
    assert total == 2
    assert set(readiness.keys()) == {o_ready.id, o_short.id}
    # 3 finished covers the qty-2 order but not the qty-10 order.
    assert readiness[o_ready.id].ready is True
    assert readiness[o_ready.id].on_hand == 3
    assert readiness[o_short.id].ready is False
    assert readiness[o_short.id].on_hand == 3


async def test_get_order_surfaces_batch_id(db_session):
    """batch_id is surfaced on the readiness-bearing read for the Envio column."""

    from services import batch as batch_service

    scene = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=scene.company.id,
        ad_id=scene.ad.id,
        variation_id=scene.variation.id,
        client_id=scene.client.id,
        quantity=2,
        external_order_id="A1",
    )
    batch = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[order.id]
    )
    row, _readiness = await order_service.get_order(db_session, company_id=scene.company.id, order_id=order.id)
    # row[0] is the Order; its batch_id now points at the created batch.
    assert row[0].batch_id == batch.id
