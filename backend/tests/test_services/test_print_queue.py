"""Cross-batch demand-driven print queue (``services.batch.list_print_queue``).

Aggregates every still-unsent ``qty_to_print`` across OPEN/ADJUSTED batches,
grouped by ``(print_design, product_color)``. Excludes done/cancelled batches,
zero-to-print rows, already-sent designs, and other tenants.
"""

from sqlmodel import select

from models import BatchPrintAdjustment, BatchStatus
from schemas.batch import BatchAdjustmentRow
from services.batch import (
    create_batch,
    list_print_queue,
    save_adjustments,
    transition_status,
)
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_print_design,
    create_print_stock_movement,
    create_product,
    create_product_spec,
    create_product_variation,
    create_user,
)
from tests.factories import (
    create_order as factory_create_order,
)


async def _scaffold(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    design = await create_print_design(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id, print_id=design.id)
    variation = await create_product_variation(db_session, company_id=company.id, product_id=product.id)
    client = await create_client(db_session, company_id=company.id)
    ad = await create_ad(db_session, company_id=company.id, product_id=product.id)
    return company, user, product, variation, client, ad, design


async def _order(db_session, company, ad, variation, client, **overrides):
    return await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        **overrides,
    )


async def test_empty_queue_when_no_batches(db_session):
    company, _, _, _, _, _, _ = await _scaffold(db_session)
    assert await list_print_queue(db_session, company_id=company.id) == []


async def test_queue_aggregates_open_batch_demand(db_session):
    company, user, _, variation, client, ad, design = await _scaffold(db_session)
    o1 = await _order(db_session, company, ad, variation, client, quantity=4, external_order_id="A1")
    await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])

    queue = await list_print_queue(db_session, company_id=company.id)
    assert len(queue) == 1
    row = queue[0]
    assert row["print_design_id"] == design.id
    assert row["product_color"] == variation.color
    assert row["qty_needed"] == 4
    assert row["qty_to_print"] == 4
    assert row["batch_count"] == 1
    assert row["design"]["code"] == design.code


async def test_queue_sums_same_design_color_across_batches(db_session):
    company, user, _, variation, client, ad, _design = await _scaffold(db_session)
    o1 = await _order(db_session, company, ad, variation, client, quantity=3, external_order_id="A1")
    o2 = await _order(db_session, company, ad, variation, client, quantity=5, external_order_id="A2")
    await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])
    await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o2.id])

    queue = await list_print_queue(db_session, company_id=company.id)
    assert len(queue) == 1
    assert queue[0]["qty_to_print"] == 8
    assert queue[0]["batch_count"] == 2


async def test_queue_excludes_zero_to_print_rows(db_session):
    company, user, _, variation, client, ad, design = await _scaffold(db_session)
    # Stock fully covers demand -> qty_to_print nets to 0 -> not in queue.
    await create_print_stock_movement(
        db_session,
        company_id=company.id,
        print_design_id=design.id,
        product_color=variation.color,
        quantity=100,
    )
    o1 = await _order(db_session, company, ad, variation, client, quantity=2, external_order_id="A1")
    await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])

    assert await list_print_queue(db_session, company_id=company.id) == []


async def test_queue_excludes_done_and_cancelled_batches(db_session):
    company, user, _, variation, client, ad, _design = await _scaffold(db_session)
    o1 = await _order(db_session, company, ad, variation, client, quantity=4, external_order_id="A1")
    batch, _ = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])
    # OPEN -> CANCELLED removes it from the queue.
    await transition_status(
        db_session, company_id=company.id, user_id=user.id, batch_id=batch.id, target=BatchStatus.CANCELLED
    )
    assert await list_print_queue(db_session, company_id=company.id) == []


async def test_queue_excludes_already_sent_designs(db_session):
    company, user, _, variation, client, ad, design = await _scaffold(db_session)
    o1 = await _order(db_session, company, ad, variation, client, quantity=4, external_order_id="A1")
    batch, _ = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])
    await save_adjustments(
        db_session,
        company_id=company.id,
        user_id=user.id,
        batch_id=batch.id,
        adjustments=[BatchAdjustmentRow(print_design_id=design.id, qty_to_print=4)],
    )
    # Mark the design as already dispatched.
    row = (await db_session.exec(select(BatchPrintAdjustment).where(BatchPrintAdjustment.batch_id == batch.id))).first()
    row.prints_sent = True
    db_session.add(row)
    await db_session.commit()

    assert await list_print_queue(db_session, company_id=company.id) == []


async def test_queue_tenant_scoped(db_session):
    company_a, user_a, _, var_a, client_a, ad_a, _ = await _scaffold(db_session)
    company_b, user_b, _, var_b, client_b, ad_b, _ = await _scaffold(db_session)
    oa = await _order(db_session, company_a, ad_a, var_a, client_a, quantity=4, external_order_id="A1")
    ob = await _order(db_session, company_b, ad_b, var_b, client_b, quantity=9, external_order_id="B1")
    await create_batch(db_session, company_id=company_a.id, user_id=user_a.id, order_ids=[oa.id])
    await create_batch(db_session, company_id=company_b.id, user_id=user_b.id, order_ids=[ob.id])

    queue_a = await list_print_queue(db_session, company_id=company_a.id)
    assert len(queue_a) == 1
    assert queue_a[0]["qty_to_print"] == 4  # never sees company B's 9
