"""Phase 6 — Dashboard Conferência summary (orders → pieces pipeline).

Exercises ``dashboard.get_summary().conference``: the headline totals (orders /
pieces / mapped / pending / checked / to_check / in_lote / mapped_pct), the
order pipeline (mapeamento / producao / separacao / envio), and the batch
lifecycle counts — all reconciled against the seeded order/order_item/batch rows.
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


async def _order(db_session, scene, **overrides):
    return await factory_create_order(
        db_session,
        company_id=scene.company.id,
        ad_id=scene.ad.id,
        variation_id=scene.variation.id,
        client_id=scene.client.id,
        **overrides,
    )


async def test_conference_totals_and_item_counts(db_session):
    scene = await _scaffold(db_session)
    # Two active orders (3 + 2 pieces) and one cancelled (excluded from totals).
    o1 = await _order(db_session, scene, quantity=3, status=OrderStatus.PAID, external_order_id="A1")
    await _order(db_session, scene, quantity=2, status=OrderStatus.PENDING, external_order_id="A2")
    await _order(db_session, scene, quantity=9, status=OrderStatus.CANCELLED, external_order_id="A3")

    # Item-level: 2 mapped (1 checked, 1 label_printed) + 1 pending (unmapped).
    await create_order_item(
        db_session,
        company_id=scene.company.id,
        order_id=o1.id,
        variation_id=scene.variation.id,
        status=SeparationStatus.CHECKED,
    )
    await create_order_item(
        db_session,
        company_id=scene.company.id,
        order_id=o1.id,
        variation_id=scene.variation.id,
        status=SeparationStatus.LABEL_PRINTED,
    )
    await create_order_item(
        db_session,
        company_id=scene.company.id,
        order_id=o1.id,
        variation_id=None,
        status=SeparationStatus.PENDING,
    )

    summary = await get_summary(db_session, company_id=scene.company.id)
    c = summary.conference
    # Totals scope = non-cancelled orders (2 orders, 5 pieces).
    assert c.totals.orders == 2
    assert c.totals.pieces == 5
    assert c.totals.mapped == 2
    assert c.totals.pending == 1
    assert c.totals.checked == 1
    assert c.totals.to_check == 1
    # mapped_pct = round(100 * 2 / (2 + 1)) = 67.
    assert c.totals.mapped_pct == 67


async def test_conference_mapped_pct_100_when_no_items(db_session):
    scene = await _scaffold(db_session)
    await _order(db_session, scene, quantity=2, status=OrderStatus.PAID, external_order_id="A1")
    summary = await get_summary(db_session, company_id=scene.company.id)
    # No order_items at all → denom 0 → 100%.
    assert summary.conference.totals.mapped_pct == 100
    assert summary.conference.totals.mapped == 0
    assert summary.conference.totals.pending == 0


async def test_conference_pipeline_buckets(db_session):
    scene = await _scaffold(db_session)
    # Mapeamento: order with an unmapped piece.
    o_unmapped = await _order(db_session, scene, quantity=1, status=OrderStatus.PAID, external_order_id="U1")
    await create_order_item(
        db_session,
        company_id=scene.company.id,
        order_id=o_unmapped.id,
        variation_id=None,
        status=SeparationStatus.PENDING,
    )
    # Separacao: mapped (no unmapped pieces), unbatched, ready (finished covers qty).
    await _order(db_session, scene, quantity=2, status=OrderStatus.PAID, external_order_id="S1")
    await create_stock_entry(db_session, company_id=scene.company.id, variation_id=scene.variation.id, quantity=2)
    # Producao: mapped, unbatched, NOT ready (no finished stock for its variation).
    spec2 = await create_product_spec(db_session, company_id=scene.company.id, code="CAM02")
    design2 = await create_print_design(db_session, company_id=scene.company.id, code="GEO01")
    product2 = await create_product(db_session, company_id=scene.company.id, spec_id=spec2.id, print_id=design2.id)
    variation2 = await create_product_variation(
        db_session, company_id=scene.company.id, product_id=product2.id, size=Size.G, color="Branco", color_code="WHT"
    )
    ad2 = await create_ad(db_session, company_id=scene.company.id, product_id=product2.id)
    await factory_create_order(
        db_session,
        company_id=scene.company.id,
        ad_id=ad2.id,
        variation_id=variation2.id,
        client_id=scene.client.id,
        quantity=4,
        status=OrderStatus.PAID,
        external_order_id="P1",
    )
    # Envio: order in a batch.
    o_batched = await _order(db_session, scene, quantity=1, status=OrderStatus.PAID, external_order_id="E1")
    await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[o_batched.id]
    )

    summary = await get_summary(db_session, company_id=scene.company.id)
    p = summary.conference.pipeline
    assert p.mapeamento == 1
    assert p.separacao == 1
    assert p.producao == 1
    assert p.envio == 1
    # in_lote reflects the batched order.
    assert summary.conference.totals.in_lote == 1


async def test_conference_batch_status_counts(db_session):
    scene = await _scaffold(db_session)
    o1 = await _order(db_session, scene, quantity=1, status=OrderStatus.PAID, external_order_id="B1")
    o2 = await _order(db_session, scene, quantity=1, status=OrderStatus.PAID, external_order_id="B2")
    b_open = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[o1.id]
    )
    b_prod = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[o2.id]
    )
    # Advance one batch to in_production.
    from models import BatchStatus

    await batch_service.transition_status(
        db_session,
        company_id=scene.company.id,
        user_id=scene.user.id,
        batch_id=b_prod.id,
        target=BatchStatus.IN_PRODUCTION,
    )

    summary = await get_summary(db_session, company_id=scene.company.id)
    b = summary.conference.batches
    assert b.open == 1
    assert b.in_production == 1
    assert b.dispatched == 0
    assert b_open.id is not None  # sanity


async def test_conference_tenant_isolation(db_session):
    """A foreign tenant's orders never bleed into this tenant's conference."""

    scene = await _scaffold(db_session)
    await _order(db_session, scene, quantity=3, status=OrderStatus.PAID, external_order_id="A1")

    other = await _scaffold(db_session)
    await _order(db_session, other, quantity=99, status=OrderStatus.PAID, external_order_id="X1")

    summary = await get_summary(db_session, company_id=scene.company.id)
    assert summary.conference.totals.orders == 1
    assert summary.conference.totals.pieces == 3
