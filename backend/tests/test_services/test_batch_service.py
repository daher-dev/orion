import uuid

import pytest
from sqlmodel import select

from models import AuditLog, Batch, BatchPrintAdjustment, BatchStatus, Order
from schemas._common import PageParams
from schemas.batch import BatchAdjustmentRow
from services.batch import (
    create_batch,
    delete_batch,
    get_batch,
    list_batches,
    save_adjustments,
    transition_status,
)
from shared.exceptions import ConflictError, NotFoundError, ValidationError
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


async def _scaffold(db_session, *, with_print=True):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    design = None
    print_id = None
    if with_print:
        design = await create_print_design(db_session, company_id=company.id)
        print_id = design.id
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id, print_id=print_id)
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


# ------------------------------------------------------------------- create


async def test_create_batch_links_orders_and_computes_totals(db_session):
    company, user, _, variation, client, ad, _ = await _scaffold(db_session)
    o1 = await _order(db_session, company, ad, variation, client, quantity=2, external_order_id="A1")
    o2 = await _order(db_session, company, ad, variation, client, quantity=3, external_order_id="A2")

    batch, _adj = await create_batch(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_ids=[o1.id, o2.id],
    )
    assert batch.status == BatchStatus.OPEN
    assert batch.total_orders == 2
    assert batch.total_pieces == 5
    assert batch.code.startswith("BATCH-")

    await db_session.refresh(o1)
    await db_session.refresh(o2)
    assert o1.batch_id == batch.id
    assert o2.batch_id == batch.id

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == batch.id))).all()
    assert any("Created batch" in a.message for a in audits)


async def test_create_batch_auto_includes_siblings_sharing_external_order_id(db_session):
    """A multi-line platform order must not be split across batches."""

    company, user, product, variation, client, ad, _ = await _scaffold(db_session)
    sibling_variation = await create_product_variation(
        db_session, company_id=company.id, product_id=product.id, color="Branco", color_code="WHT"
    )
    # Two lines of the same platform order (shared external_order_id).
    line1 = await _order(db_session, company, ad, variation, client, external_order_id="PED-1")
    line2 = await _order(db_session, company, ad, sibling_variation, client, external_order_id="PED-1")

    # Operator only selected line1.
    batch, _adj = await create_batch(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_ids=[line1.id],
    )
    assert batch.total_orders == 2

    await db_session.refresh(line2)
    assert line2.batch_id == batch.id


async def test_create_batch_rejects_already_batched_order(db_session):
    company, user, _, variation, client, ad, _ = await _scaffold(db_session)
    o1 = await _order(db_session, company, ad, variation, client, external_order_id="A1")
    await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])

    o2 = await _order(db_session, company, ad, variation, client, external_order_id="A2")
    with pytest.raises(ConflictError):
        await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id, o2.id])


async def test_create_batch_rejects_unknown_order(db_session):
    company, user, _, _, _, _, _ = await _scaffold(db_session)
    with pytest.raises(ValidationError):
        await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[uuid.uuid4()])


async def test_create_batch_aggregates_adjustments_by_design_and_colour(db_session):
    company, user, _, variation, client, ad, design = await _scaffold(db_session)
    await _order(db_session, company, ad, variation, client, quantity=2, external_order_id="A1")
    await _order(db_session, company, ad, variation, client, quantity=3, external_order_id="A2")

    _batch, adjustments = await create_batch(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_ids=[o.id for o in (await db_session.exec(select(Order).where(Order.company_id == company.id))).all()],
    )
    assert len(adjustments) == 1
    adj, code, _name = adjustments[0]
    assert adj.print_design_id == design.id
    assert adj.product_color == variation.color
    assert adj.qty_needed == 5
    assert adj.qty_to_print == 5  # defaults to needed
    assert code == design.code


async def test_create_batch_reflects_print_stock_on_hand_in_qty_stock(db_session):
    """qty_stock must net against the real printed-stamp ledger, not be 0."""
    company, user, _, variation, client, ad, design = await _scaffold(db_session)
    # 6 printed stamps on hand for this (design, colour).
    await create_print_stock_movement(
        db_session,
        company_id=company.id,
        print_design_id=design.id,
        product_color=variation.color,
        quantity=6,
    )
    o1 = await _order(db_session, company, ad, variation, client, quantity=4, external_order_id="A1")

    _batch, adjustments = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])
    assert len(adjustments) == 1
    adj = adjustments[0][0]
    assert adj.product_color == variation.color
    assert adj.qty_needed == 4
    assert adj.qty_stock == 6  # netted from the print-stock ledger


async def test_create_batch_skips_products_without_print_design(db_session):
    company, user, _, variation, client, ad, _ = await _scaffold(db_session, with_print=False)
    o1 = await _order(db_session, company, ad, variation, client, external_order_id="A1")
    _batch, adjustments = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])
    assert adjustments == []


# -------------------------------------------------------------- adjustments


async def test_save_adjustments_updates_qty_and_advances_status(db_session):
    company, user, _, variation, client, ad, design = await _scaffold(db_session)
    o1 = await _order(db_session, company, ad, variation, client, quantity=4, external_order_id="A1")
    batch, _adj = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])

    batch2, adjustments = await save_adjustments(
        db_session,
        company_id=company.id,
        user_id=user.id,
        batch_id=batch.id,
        adjustments=[BatchAdjustmentRow(print_design_id=design.id, qty_to_print=10)],
    )
    assert batch2.status == BatchStatus.ADJUSTED
    assert adjustments[0][0].qty_to_print == 10


# ------------------------------------------------------------------ status


async def test_transition_status_enforces_state_machine(db_session):
    company, user, _, variation, client, ad, _ = await _scaffold(db_session)
    o1 = await _order(db_session, company, ad, variation, client, external_order_id="A1")
    batch, _adj = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])

    # OPEN -> PRINTED is illegal (must go through ADJUSTED).
    with pytest.raises(ConflictError):
        await transition_status(
            db_session, company_id=company.id, user_id=user.id, batch_id=batch.id, target=BatchStatus.PRINTED
        )

    # OPEN -> CANCELLED is allowed.
    cancelled, _ = await transition_status(
        db_session, company_id=company.id, user_id=user.id, batch_id=batch.id, target=BatchStatus.CANCELLED
    )
    assert cancelled.status == BatchStatus.CANCELLED


# ------------------------------------------------------------------- list


async def test_list_batches_scoped_and_filtered(db_session):
    company_a, user_a, _, var_a, client_a, ad_a, _ = await _scaffold(db_session)
    company_b, user_b, _, var_b, client_b, ad_b, _ = await _scaffold(db_session)
    oa = await _order(db_session, company_a, ad_a, var_a, client_a, external_order_id="A1")
    ob = await _order(db_session, company_b, ad_b, var_b, client_b, external_order_id="B1")
    await create_batch(db_session, company_id=company_a.id, user_id=user_a.id, order_ids=[oa.id])
    await create_batch(db_session, company_id=company_b.id, user_id=user_b.id, order_ids=[ob.id])

    rows, total = await list_batches(db_session, company_id=company_a.id, page=PageParams())
    assert total == 1
    assert rows[0].company_id == company_a.id

    _rows, none_done = await list_batches(
        db_session, company_id=company_a.id, status=BatchStatus.DONE, page=PageParams()
    )
    assert none_done == 0


# ------------------------------------------------------------------ delete


async def test_delete_batch_unlinks_orders_and_cascades_adjustments(db_session):
    company, user, _, variation, client, ad, _ = await _scaffold(db_session)
    o1 = await _order(db_session, company, ad, variation, client, external_order_id="A1")
    batch, _adj = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])

    await delete_batch(db_session, company_id=company.id, user_id=user.id, batch_id=batch.id)

    assert (await db_session.exec(select(Batch).where(Batch.id == batch.id))).first() is None
    await db_session.refresh(o1)
    assert o1.batch_id is None
    leftover = (
        await db_session.exec(select(BatchPrintAdjustment).where(BatchPrintAdjustment.batch_id == batch.id))
    ).all()
    assert leftover == []


async def test_get_batch_not_found_and_tenant_isolation(db_session):
    company_a, _, _, _, _, _, _ = await _scaffold(db_session)
    company_b, user_b, _, var_b, client_b, ad_b, _ = await _scaffold(db_session)
    ob = await _order(db_session, company_b, ad_b, var_b, client_b, external_order_id="B1")
    batch_b, _ = await create_batch(db_session, company_id=company_b.id, user_id=user_b.id, order_ids=[ob.id])

    with pytest.raises(NotFoundError):
        await get_batch(db_session, company_id=company_a.id, batch_id=batch_b.id)
