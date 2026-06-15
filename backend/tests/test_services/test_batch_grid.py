"""Phase 6 — Lote (Batch) computed estampa grid + montar (T5) + enviar (T6).

Covers ``batch.get_batch_detail`` (the per-estampa grid + roll-ups),
``batch.assemble_batch`` (bulk assemble the SKUs the batch is short on, reusing
T5, with partial-failure → ``skipped``), and ``batch.ship_batch`` (readiness-
gated T6 ship of every member order). All tenant-scoped.
"""

import uuid
from dataclasses import dataclass

import pytest
from sqlmodel import select

from models import (
    BatchStatus,
    BlankMovementKind,
    OrderStatus,
    PrintSide,
    PrintTechnique,
    Size,
    StockEntry,
    StockExit,
    StockExitReason,
)
from schemas.batch import BatchAssembleBody, BatchAssembleRow
from services import batch as batch_service
from services import blank_stock as blank_stock_service
from services import printed_transfer as printed_transfer_service
from services import stock as stock_service
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import (
    create_ad,
    create_blank_piece,
    create_blank_piece_movement,
    create_client,
    create_company,
    create_print_design,
    create_printed_transfer,
    create_printed_transfer_movement,
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
    spec: object
    design: object
    product: object
    variation: object
    client: object
    ad: object


async def _scaffold(db_session, *, code="CAM01", print_code="FLR03", color_code="BLK", size=Size.M) -> _Scene:
    """A spec + design + product(spec,print) + one variation, plus an ad listing it."""

    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code=code)
    design = await create_print_design(
        db_session, company_id=company.id, code=print_code, technique=PrintTechnique.DTF, has_front=True
    )
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id, print_id=design.id)
    variation = await create_product_variation(
        db_session,
        company_id=company.id,
        product_id=product.id,
        size=size,
        color="Preto",
        color_code=color_code,
    )
    client = await create_client(db_session, company_id=company.id)
    ad = await create_ad(db_session, company_id=company.id, product_id=product.id)
    return _Scene(
        company=company, user=user, spec=spec, design=design, product=product, variation=variation, client=client, ad=ad
    )


async def _order(db_session, scene: _Scene, **overrides):
    return await factory_create_order(
        db_session,
        company_id=scene.company.id,
        ad_id=scene.ad.id,
        variation_id=scene.variation.id,
        client_id=scene.client.id,
        **overrides,
    )


async def _credit_blank(db_session, *, scene: _Scene, qty):
    piece = await create_blank_piece(
        db_session,
        company_id=scene.company.id,
        spec_id=scene.spec.id,
        size=scene.variation.size,
        color="Preto",
        color_code=scene.variation.color_code,
    )
    await create_blank_piece_movement(
        db_session, company_id=scene.company.id, blank_piece_id=piece.id, kind=BlankMovementKind.ENTRY, quantity=qty
    )
    return piece


async def _credit_printed(db_session, *, scene: _Scene, qty, side=PrintSide.FRONT):
    transfer = await create_printed_transfer(
        db_session, company_id=scene.company.id, print_design_id=scene.design.id, side=side
    )
    await create_printed_transfer_movement(
        db_session,
        company_id=scene.company.id,
        printed_transfer_id=transfer.id,
        kind=printed_transfer_service.PrintedMovementKind.ENTRY,
        quantity=qty,
    )
    return transfer


# --------------------------------------------------------------------- grid


async def test_grid_items_to_print_montado_enviado(db_session):
    scene = await _scaffold(db_session)
    # Two orders for the same SKU: 3 + 2 = 5 pieces of one estampa.
    o1 = await _order(db_session, scene, quantity=3, external_order_id="A1")
    o2 = await _order(db_session, scene, quantity=2, external_order_id="A2")
    batch = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[o1.id, o2.id]
    )

    # 2 FRONT transfers on hand, and 1 finished piece in stock.
    await _credit_printed(db_session, scene=scene, qty=2)
    await create_stock_entry(db_session, company_id=scene.company.id, variation_id=scene.variation.id, quantity=1)

    detail = await batch_service.get_batch_detail(db_session, company_id=scene.company.id, batch_id=batch.id)
    assert len(detail.estampas) == 1
    row = detail.estampas[0]
    assert row.code == scene.design.code
    assert row.items == 5
    # to_print = max(0, 5 - 2 front on hand) = 3.
    assert row.to_print == 3
    # montado = min(5 needed, 1 finished) = 1; not assembled.
    assert row.montado == 1
    assert row.is_assembled is False
    assert row.enviado == 0
    assert row.is_shipped is False

    # Roll-ups.
    assert detail.orders_total == 2
    assert detail.pieces_total == 5
    assert detail.to_print_total == 3
    assert detail.needs_assembly is True
    # Not all ready (1 < 5) → cannot ship.
    assert detail.orders_ready == 0
    assert detail.can_ship is False


async def test_grid_no_estampa_bucket(db_session):
    """A product with no print buckets under a synthetic design=None row."""

    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM02")
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id, print_id=None)
    variation = await create_product_variation(db_session, company_id=company.id, product_id=product.id)
    client = await create_client(db_session, company_id=company.id)
    ad = await create_ad(db_session, company_id=company.id, product_id=product.id)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        quantity=4,
        external_order_id="N1",
    )
    batch = await batch_service.create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[order.id])

    detail = await batch_service.get_batch_detail(db_session, company_id=company.id, batch_id=batch.id)
    assert len(detail.estampas) == 1
    row = detail.estampas[0]
    assert row.design is None
    assert row.code == "—"
    assert row.items == 4
    assert row.to_print == 0  # no transfer to print for a no-estampa bucket


async def test_get_batch_detail_not_found(db_session):
    company = await create_company(db_session)
    with pytest.raises(NotFoundError):
        await batch_service.get_batch_detail(db_session, company_id=company.id, batch_id=uuid.uuid4())


async def test_grid_tenant_isolation(db_session):
    scene = await _scaffold(db_session)
    order = await _order(db_session, scene, quantity=2, external_order_id="A1")
    batch = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[order.id]
    )

    other = await create_company(db_session)
    with pytest.raises(NotFoundError):
        await batch_service.get_batch_detail(db_session, company_id=other.id, batch_id=batch.id)


# ----------------------------------------------------------- assemble (montar)


async def test_assemble_batch_credits_finished_and_advances_status(db_session):
    scene = await _scaffold(db_session)
    order = await _order(db_session, scene, quantity=5, external_order_id="A1")
    batch = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[order.id]
    )

    # Components on hand: 10 blanks + 10 printed (covers the need of 5).
    await _credit_blank(db_session, scene=scene, qty=10)
    transfer = await _credit_printed(db_session, scene=scene, qty=10)

    result = await batch_service.assemble_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, batch_id=batch.id, payload=BatchAssembleBody()
    )
    assert len(result.assembled) == 1
    assert result.assembled[0].quantity == 5
    assert result.skipped == []
    # Finished stock for the ordered variation now == 5.
    assert (
        await stock_service._compute_on_hand(db_session, company_id=scene.company.id, variation_id=scene.variation.id)
        == 5
    )
    # Components debited 5 each.
    blank_map = await blank_stock_service.compute_on_hand_map(db_session, company_id=scene.company.id)
    assert sum(blank_map.values()) == 5
    assert (
        await printed_transfer_service._compute_on_hand(
            db_session, company_id=scene.company.id, printed_transfer_id=transfer.id
        )
        == 5
    )
    # Batch advanced OPEN -> IN_PRODUCTION; grid montado rose; order now ready.
    assert result.batch.status == BatchStatus.IN_PRODUCTION
    assert result.batch.estampas[0].montado == 5
    assert result.batch.estampas[0].is_assembled is True
    assert result.batch.orders_ready == 1


async def test_assemble_batch_partial_failure_skips_not_409(db_session):
    """One component-short SKU lands in skipped; the rest still assemble."""

    scene = await _scaffold(db_session)
    order = await _order(db_session, scene, quantity=8, external_order_id="A1")
    batch = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[order.id]
    )

    # Plenty of blanks but only 3 printed transfers → can't cover need of 8.
    await _credit_blank(db_session, scene=scene, qty=20)
    await _credit_printed(db_session, scene=scene, qty=3)

    # Snapshot ids/sku before the call — a no-success montar rolls back, which
    # expires caller-held ORM objects.
    company_id, variation_id, variation_sku = scene.company.id, scene.variation.id, scene.variation.sku
    result = await batch_service.assemble_batch(
        db_session, company_id=company_id, user_id=scene.user.id, batch_id=batch.id, payload=BatchAssembleBody()
    )
    assert result.assembled == []
    assert len(result.skipped) == 1
    assert result.skipped[0].reason == "insufficient_printed"
    assert result.skipped[0].sku == variation_sku
    # Nothing credited; batch stays OPEN (no success).
    assert await stock_service._compute_on_hand(db_session, company_id=company_id, variation_id=variation_id) == 0
    assert result.batch.status == BatchStatus.OPEN


async def test_assemble_batch_skips_already_covered(db_session):
    """A SKU already fully in finished stock contributes nothing to assemble."""

    scene = await _scaffold(db_session)
    order = await _order(db_session, scene, quantity=4, external_order_id="A1")
    batch = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[order.id]
    )

    # Already 4 finished in stock → need is 0.
    await create_stock_entry(db_session, company_id=scene.company.id, variation_id=scene.variation.id, quantity=4)
    await _credit_blank(db_session, scene=scene, qty=10)
    await _credit_printed(db_session, scene=scene, qty=10)

    result = await batch_service.assemble_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, batch_id=batch.id, payload=BatchAssembleBody()
    )
    assert result.assembled == []
    assert result.skipped == []
    assert result.batch.status == BatchStatus.OPEN  # no assemble happened


async def test_assemble_batch_partial_rows_restriction(db_session):
    """``rows`` restricts montar to specific designs."""

    scene = await _scaffold(db_session)
    order = await _order(db_session, scene, quantity=5, external_order_id="A1")
    batch = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[order.id]
    )
    await _credit_blank(db_session, scene=scene, qty=10)
    await _credit_printed(db_session, scene=scene, qty=10)

    # Snapshot before the call — a no-success montar rolls back (expires objects).
    company_id, variation_id = scene.company.id, scene.variation.id
    # Restrict to a DIFFERENT design id → nothing matches → no assemble.
    result = await batch_service.assemble_batch(
        db_session,
        company_id=company_id,
        user_id=scene.user.id,
        batch_id=batch.id,
        payload=BatchAssembleBody(rows=[BatchAssembleRow(design_id=uuid.uuid4(), quantity=5)]),
    )
    assert result.assembled == []
    assert await stock_service._compute_on_hand(db_session, company_id=company_id, variation_id=variation_id) == 0


async def test_assemble_batch_empty_batch_conflicts(db_session):
    scene = await _scaffold(db_session)
    # Build a batch then unlink its only order so it has no members.
    order = await _order(db_session, scene, quantity=2, external_order_id="A1")
    batch = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[order.id]
    )
    from models import Order

    o = (await db_session.exec(select(Order).where(Order.id == order.id))).first()
    o.batch_id = None
    db_session.add(o)
    await db_session.commit()

    with pytest.raises(ConflictError):
        await batch_service.assemble_batch(
            db_session,
            company_id=scene.company.id,
            user_id=scene.user.id,
            batch_id=batch.id,
            payload=BatchAssembleBody(),
        )


# --------------------------------------------------------------- ship (enviar)


async def test_ship_batch_ships_all_and_dispatches(db_session):
    scene = await _scaffold(db_session)
    o1 = await _order(db_session, scene, quantity=2, status=OrderStatus.PAID, external_order_id="A1")
    o2 = await _order(db_session, scene, quantity=3, status=OrderStatus.PAID, external_order_id="A2")
    batch = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[o1.id, o2.id]
    )

    # Finished stock covers both (2 + 3 = 5).
    await create_stock_entry(db_session, company_id=scene.company.id, variation_id=scene.variation.id, quantity=5)

    detail = await batch_service.ship_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, batch_id=batch.id
    )
    assert detail.status == BatchStatus.DISPATCHED

    # Both orders SHIPPED with one sale exit each; finished stock 5 → 0.
    from models import Order

    o1_db = (await db_session.exec(select(Order).where(Order.id == o1.id))).first()
    o2_db = (await db_session.exec(select(Order).where(Order.id == o2.id))).first()
    assert o1_db.status == OrderStatus.SHIPPED
    assert o2_db.status == OrderStatus.SHIPPED
    exits = list((await db_session.exec(select(StockExit).where(StockExit.company_id == scene.company.id))).all())
    assert len(exits) == 2
    assert all(e.reason == StockExitReason.SALE for e in exits)
    assert (
        await stock_service._compute_on_hand(db_session, company_id=scene.company.id, variation_id=scene.variation.id)
        == 0
    )
    # Grid now shows everything shipped.
    assert detail.estampas[0].enviado == 5
    assert detail.estampas[0].is_shipped is True


async def test_ship_batch_blocked_when_not_ready(db_session):
    """Any member not order-ready → 409, nothing ships."""

    scene = await _scaffold(db_session)
    o1 = await _order(db_session, scene, quantity=2, status=OrderStatus.PAID, external_order_id="A1")
    o2 = await _order(db_session, scene, quantity=3, status=OrderStatus.PAID, external_order_id="A2")
    batch = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[o1.id, o2.id]
    )

    # Only 4 finished (covers 2+? no — total need 5) → not all ready.
    await create_stock_entry(db_session, company_id=scene.company.id, variation_id=scene.variation.id, quantity=4)

    with pytest.raises(ConflictError):
        await batch_service.ship_batch(
            db_session, company_id=scene.company.id, user_id=scene.user.id, batch_id=batch.id
        )

    # Nothing shipped, no exits, batch still OPEN.
    from models import Order

    o1_db = (await db_session.exec(select(Order).where(Order.id == o1.id))).first()
    assert o1_db.status == OrderStatus.PAID
    exits = list((await db_session.exec(select(StockExit).where(StockExit.company_id == scene.company.id))).all())
    assert exits == []
    refreshed = await batch_service.get_batch(db_session, company_id=scene.company.id, batch_id=batch.id)
    assert refreshed.status == BatchStatus.OPEN


async def test_ship_batch_idempotent_per_order(db_session):
    """An already-shipped member is skipped; only the unshipped one debits."""

    scene = await _scaffold(db_session)
    o1 = await _order(db_session, scene, quantity=2, status=OrderStatus.SHIPPED, external_order_id="A1")
    o2 = await _order(db_session, scene, quantity=3, status=OrderStatus.PAID, external_order_id="A2")
    batch = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[o1.id, o2.id]
    )

    # o1 already shipped (no exit recorded out-of-band) but status SHIPPED; o2 needs 3.
    await create_stock_entry(db_session, company_id=scene.company.id, variation_id=scene.variation.id, quantity=3)

    detail = await batch_service.ship_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, batch_id=batch.id
    )
    assert detail.status == BatchStatus.DISPATCHED
    # Only one exit (for o2); o1 was idempotently skipped.
    exits = list((await db_session.exec(select(StockExit).where(StockExit.company_id == scene.company.id))).all())
    assert len(exits) == 1
    assert exits[0].order_id == o2.id


async def test_ship_batch_empty_conflicts(db_session):
    scene = await _scaffold(db_session)
    order = await _order(db_session, scene, quantity=2, status=OrderStatus.PAID, external_order_id="A1")
    batch = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[order.id]
    )
    from models import Order

    o = (await db_session.exec(select(Order).where(Order.id == order.id))).first()
    o.batch_id = None
    db_session.add(o)
    await db_session.commit()

    with pytest.raises(ConflictError):
        await batch_service.ship_batch(
            db_session, company_id=scene.company.id, user_id=scene.user.id, batch_id=batch.id
        )


async def test_ship_batch_rejects_dispatched_batch(db_session):
    """A batch not in {open, in_production} can't be shipped (illegal transition)."""

    scene = await _scaffold(db_session)
    order = await _order(db_session, scene, quantity=2, status=OrderStatus.PAID, external_order_id="A1")
    batch = await batch_service.create_batch(
        db_session, company_id=scene.company.id, user_id=scene.user.id, order_ids=[order.id]
    )
    await create_stock_entry(db_session, company_id=scene.company.id, variation_id=scene.variation.id, quantity=2)
    # First ship → dispatched.
    await batch_service.ship_batch(db_session, company_id=scene.company.id, user_id=scene.user.id, batch_id=batch.id)
    # Second ship → illegal (dispatched -> dispatched not allowed).
    with pytest.raises(ConflictError):
        await batch_service.ship_batch(
            db_session, company_id=scene.company.id, user_id=scene.user.id, batch_id=batch.id
        )


# Keep StockEntry import meaningful for readers grepping the seed helpers.
_ = StockEntry
