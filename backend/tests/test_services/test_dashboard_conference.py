"""Dashboard Conferência summary (orders → pieces pipeline).

Exercises ``dashboard.get_summary().conference``: the headline totals (orders /
pieces / mapped / pending / mapped_pct / in_lote), the order-level checked
classification (orders_checked / orders_partial / orders_untouched), and the
piece-level checked count — all reconciled against the seeded order/order_item
rows.
"""

from dataclasses import dataclass

from models import OrderStatus, SeparationStatus, Size
from services import batch as batch_service
from services.dashboard import get_summary
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_order_item,
    create_print_design,
    create_product,
    create_product_spec,
    create_product_variation,
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


async def _order(db_session, scene, **overrides):
    return await factory_create_order(
        db_session,
        company_id=scene.company.id,
        ad_id=scene.ad.id,
        variation_id=scene.variation.id,
        client_id=scene.client.id,
        **overrides,
    )


async def _item(db_session, scene, order, status, *, mapped=True):
    return await create_order_item(
        db_session,
        company_id=scene.company.id,
        order_id=order.id,
        variation_id=scene.variation.id if mapped else None,
        status=status,
    )


async def test_conference_totals_and_item_counts(db_session):
    scene = await _scaffold(db_session)
    # Two active orders (3 + 2 pieces) and one cancelled (excluded from totals).
    o1 = await _order(db_session, scene, quantity=3, status=OrderStatus.PAID, external_order_id="A1")
    await _order(db_session, scene, quantity=2, status=OrderStatus.PENDING, external_order_id="A2")
    await _order(db_session, scene, quantity=9, status=OrderStatus.CANCELLED, external_order_id="A3")

    # o1's items: 2 mapped (1 checked, 1 label_printed) + 1 pending (unmapped).
    await _item(db_session, scene, o1, SeparationStatus.CHECKED)
    await _item(db_session, scene, o1, SeparationStatus.LABEL_PRINTED)
    await _item(db_session, scene, o1, SeparationStatus.PENDING, mapped=False)

    summary = await get_summary(db_session, company_id=scene.company.id)
    c = summary.conference
    # Totals scope = non-cancelled orders (2 orders, 5 pieces).
    assert c.totals.orders == 2
    assert c.totals.pieces == 5
    assert c.totals.mapped == 2
    assert c.totals.pending == 1
    assert c.totals.pieces_checked == 1
    # mapped_pct = round(100 * 2 / (2 + 1)) = 67.
    assert c.totals.mapped_pct == 67
    # o1 has 1 of 3 items checked -> partial; o2 has no items -> untouched.
    assert c.totals.orders_checked == 0
    assert c.totals.orders_partial == 1
    assert c.totals.orders_untouched == 1


async def test_conference_mapped_pct_100_when_no_items(db_session):
    scene = await _scaffold(db_session)
    await _order(db_session, scene, quantity=2, status=OrderStatus.PAID, external_order_id="A1")
    summary = await get_summary(db_session, company_id=scene.company.id)
    c = summary.conference
    # No order_items at all → denom 0 → 100%; the order counts as untouched.
    assert c.totals.mapped_pct == 100
    assert c.totals.mapped == 0
    assert c.totals.pending == 0
    assert c.totals.pieces_checked == 0
    assert c.totals.orders_checked == 0
    assert c.totals.orders_partial == 0
    assert c.totals.orders_untouched == 1


async def test_conference_order_checked_classification(db_session):
    """Every non-cancelled order falls into exactly one of checked / partial /
    untouched, and the three sum to the order count."""
    scene = await _scaffold(db_session)
    # A: all items checked.
    a = await _order(db_session, scene, quantity=2, status=OrderStatus.PAID, external_order_id="A")
    await _item(db_session, scene, a, SeparationStatus.CHECKED)
    await _item(db_session, scene, a, SeparationStatus.CHECKED)
    # B: one checked, one not -> partial.
    b = await _order(db_session, scene, quantity=2, status=OrderStatus.PAID, external_order_id="B")
    await _item(db_session, scene, b, SeparationStatus.CHECKED)
    await _item(db_session, scene, b, SeparationStatus.LABEL_PRINTED)
    # C: items, none checked -> untouched.
    c_order = await _order(db_session, scene, quantity=2, status=OrderStatus.PAID, external_order_id="C")
    await _item(db_session, scene, c_order, SeparationStatus.PENDING)
    await _item(db_session, scene, c_order, SeparationStatus.LABEL_PRINTED)
    # D: no items at all -> untouched.
    await _order(db_session, scene, quantity=1, status=OrderStatus.PAID, external_order_id="D")

    c = (await get_summary(db_session, company_id=scene.company.id)).conference
    assert c.totals.orders == 4
    assert c.totals.orders_checked == 1
    assert c.totals.orders_partial == 1
    assert c.totals.orders_untouched == 2
    assert c.totals.orders_checked + c.totals.orders_partial + c.totals.orders_untouched == c.totals.orders
    # pieces_checked = 2 (A) + 1 (B) = 3.
    assert c.totals.pieces_checked == 3


async def test_conference_in_lote_count(db_session):
    """``in_lote`` counts orders attached to a batch (drives the report grid)."""
    scene = await _scaffold(db_session)
    o1 = await _order(db_session, scene, quantity=1, status=OrderStatus.PAID, external_order_id="B1")
    await _order(db_session, scene, quantity=1, status=OrderStatus.PAID, external_order_id="B2")
    await batch_service.create_batch(db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[o1.id])

    c = (await get_summary(db_session, company_id=scene.company.id)).conference
    assert c.totals.orders == 2
    assert c.totals.in_lote == 1


async def test_conference_tenant_isolation(db_session):
    """A foreign tenant's orders never bleed into this tenant's conference."""

    scene = await _scaffold(db_session)
    await _order(db_session, scene, quantity=3, status=OrderStatus.PAID, external_order_id="A1")

    other = await _scaffold(db_session)
    await _order(db_session, other, quantity=99, status=OrderStatus.PAID, external_order_id="X1")

    summary = await get_summary(db_session, company_id=scene.company.id)
    assert summary.conference.totals.orders == 1
    assert summary.conference.totals.pieces == 3
