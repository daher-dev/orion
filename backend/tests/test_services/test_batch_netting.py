"""Auto-netting of ``qty_to_print`` against the printed-stamp ledger.

A new ``BatchPrintAdjustment`` row defaults ``qty_to_print`` to the SHORTFALL
``max(0, qty_needed - on_hand)`` so the operator only prints what stock cannot
already cover. A manual override on an existing row survives a recompute.
"""

from sqlmodel import select

from models import BatchPrintAdjustment, BatchStatus
from schemas.batch import BatchAdjustmentRow
from services.batch import create_batch, save_adjustments, transition_status
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


async def test_zero_on_hand_nets_to_full_needed(db_session):
    company, user, _, variation, client, ad, _ = await _scaffold(db_session)
    o1 = await _order(db_session, company, ad, variation, client, quantity=7, external_order_id="A1")

    _batch, adjustments = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])
    adj = adjustments[0][0]
    assert adj.qty_needed == 7
    assert adj.qty_stock == 0
    assert adj.qty_to_print == 7  # nothing on hand -> print everything


async def test_partial_on_hand_nets_to_shortfall(db_session):
    company, user, _, variation, client, ad, design = await _scaffold(db_session)
    await create_print_stock_movement(
        db_session,
        company_id=company.id,
        print_design_id=design.id,
        product_color=variation.color,
        quantity=3,
    )
    o1 = await _order(db_session, company, ad, variation, client, quantity=10, external_order_id="A1")

    _batch, adjustments = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])
    adj = adjustments[0][0]
    assert adj.qty_needed == 10
    assert adj.qty_stock == 3
    assert adj.qty_to_print == 7  # max(0, 10 - 3)


async def test_on_hand_covers_demand_nets_to_zero(db_session):
    company, user, _, variation, client, ad, design = await _scaffold(db_session)
    await create_print_stock_movement(
        db_session,
        company_id=company.id,
        print_design_id=design.id,
        product_color=variation.color,
        quantity=20,
    )
    o1 = await _order(db_session, company, ad, variation, client, quantity=4, external_order_id="A1")

    _batch, adjustments = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])
    adj = adjustments[0][0]
    assert adj.qty_needed == 4
    assert adj.qty_stock == 20
    assert adj.qty_to_print == 0  # fully covered -> nothing to print


async def test_operator_override_preserved_across_recompute(db_session):
    """Once an operator sets qty_to_print, a later recompute must not clobber it."""
    company, user, _, variation, client, ad, design = await _scaffold(db_session)
    o1 = await _order(db_session, company, ad, variation, client, quantity=5, external_order_id="A1")
    batch, _ = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])

    # Operator overrides to 99 (e.g. printing spares).
    await save_adjustments(
        db_session,
        company_id=company.id,
        user_id=user.id,
        batch_id=batch.id,
        adjustments=[BatchAdjustmentRow(print_design_id=design.id, qty_to_print=99)],
    )

    # Add print stock AFTER the override, then drive a recompute by reusing the
    # service helper directly: the existing (overridden) row must keep 99 while
    # only its qty_needed/qty_stock snapshot refreshes.
    await create_print_stock_movement(
        db_session,
        company_id=company.id,
        print_design_id=design.id,
        product_color=variation.color,
        quantity=50,
    )
    from services.batch import _get_batch, _recompute_adjustments

    batch_obj = await _get_batch(db_session, company_id=company.id, batch_id=batch.id)
    await _recompute_adjustments(db_session, company_id=company.id, batch=batch_obj)
    await db_session.commit()

    rows = (await db_session.exec(select(BatchPrintAdjustment).where(BatchPrintAdjustment.batch_id == batch.id))).all()
    assert len(rows) == 1
    assert rows[0].qty_to_print == 99  # operator override survives recompute
    assert rows[0].qty_stock == 50  # snapshot refreshed


async def test_printed_transition_writes_print_stock_exit_and_is_idempotent(db_session):
    """PRINTED debits the ledger exactly once (idempotency via stock_committed_at)."""
    from models import PrintStockDirection, PrintStockMovement

    company, user, _, variation, client, ad, design = await _scaffold(db_session)
    o1 = await _order(db_session, company, ad, variation, client, quantity=6, external_order_id="A1")
    batch, _ = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])

    # OPEN -> ADJUSTED (qty_to_print defaults to 6, on_hand 0).
    await save_adjustments(
        db_session,
        company_id=company.id,
        user_id=user.id,
        batch_id=batch.id,
        adjustments=[BatchAdjustmentRow(print_design_id=design.id, qty_to_print=6)],
    )

    # ADJUSTED -> PRINTED writes the exit.
    await transition_status(
        db_session, company_id=company.id, user_id=user.id, batch_id=batch.id, target=BatchStatus.PRINTED
    )

    exits = (
        await db_session.exec(
            select(PrintStockMovement).where(
                PrintStockMovement.batch_id == batch.id,
                PrintStockMovement.direction == PrintStockDirection.EXIT,
            )
        )
    ).all()
    assert len(exits) == 1
    assert exits[0].quantity == 6
    assert exits[0].print_design_id == design.id
    assert exits[0].product_color == variation.color

    adj = (await db_session.exec(select(BatchPrintAdjustment).where(BatchPrintAdjustment.batch_id == batch.id))).first()
    assert adj.stock_committed_at is not None

    # PRINTED -> PRINTED (no-op) must not write a second exit.
    await transition_status(
        db_session, company_id=company.id, user_id=user.id, batch_id=batch.id, target=BatchStatus.PRINTED
    )
    exits_again = (
        await db_session.exec(
            select(PrintStockMovement).where(
                PrintStockMovement.batch_id == batch.id,
                PrintStockMovement.direction == PrintStockDirection.EXIT,
            )
        )
    ).all()
    assert len(exits_again) == 1  # still exactly one


async def test_zero_to_print_rows_write_no_exit(db_session):
    """A row fully covered by stock (qty_to_print == 0) must not debit the ledger."""
    from models import PrintStockDirection, PrintStockMovement

    company, user, _, variation, client, ad, design = await _scaffold(db_session)
    await create_print_stock_movement(
        db_session,
        company_id=company.id,
        print_design_id=design.id,
        product_color=variation.color,
        quantity=100,
    )
    o1 = await _order(db_session, company, ad, variation, client, quantity=3, external_order_id="A1")
    batch, _ = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[o1.id])

    await transition_status(
        db_session, company_id=company.id, user_id=user.id, batch_id=batch.id, target=BatchStatus.ADJUSTED
    )
    await transition_status(
        db_session, company_id=company.id, user_id=user.id, batch_id=batch.id, target=BatchStatus.PRINTED
    )

    exits = (
        await db_session.exec(
            select(PrintStockMovement).where(
                PrintStockMovement.batch_id == batch.id,
                PrintStockMovement.direction == PrintStockDirection.EXIT,
            )
        )
    ).all()
    assert exits == []
