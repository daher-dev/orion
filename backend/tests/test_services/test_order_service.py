import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlmodel import select

from models import (
    AuditLog,
    Ecommerce,
    Order,
    OrderStatus,
    StockEntry,
    StockExit,
    StockExitReason,
    StockSource,
)
from schemas._common import PageParams
from schemas.order import OrderCreate, OrderFilters, OrderUpdate
from services.order import (
    create_order,
    delete_order,
    get_order,
    list_orders,
    transition_status,
    update_order,
)
from shared.exceptions import ConflictError, NotFoundError, ValidationError
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_product,
    create_product_spec,
    create_product_variation,
    create_stock_entry,
    create_stock_exit,
    create_user,
)
from tests.factories import (
    create_order as factory_create_order,
)

# ------------------------------------------------------------------- helpers


async def _scaffold(db_session):
    """Provision: company, user, spec, product, variation, client, ad."""

    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    variation = await create_product_variation(db_session, company_id=company.id, product_id=product.id)
    client = await create_client(db_session, company_id=company.id)
    ad = await create_ad(db_session, company_id=company.id, product_id=product.id)
    return company, user, product, variation, client, ad


# ----------------------------------------------------------------- create


async def test_create_order_persists_and_audits(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)

    row, _readiness = await create_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=OrderCreate(
            ad_id=ad.id,
            variation_id=variation.id,
            client_id=client.id,
            quantity=2,
            sale_price=Decimal("149.00"),
            ordered_at=datetime.now(UTC),
            external_order_id="EXT-1",
        ),
    )
    order = row[0]
    assert order.status == OrderStatus.PENDING
    assert order.company_id == company.id

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == order.id))).all()
    assert any("Created order ORD-" in a.message for a in audits)


async def test_create_order_rejects_variation_from_other_product(db_session):
    company, user, _, _, client, ad = await _scaffold(db_session)
    spec2 = await create_product_spec(db_session, company_id=company.id)
    other_product = await create_product(db_session, company_id=company.id, spec_id=spec2.id)
    other_variation = await create_product_variation(db_session, company_id=company.id, product_id=other_product.id)

    with pytest.raises(ValidationError):
        await create_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=OrderCreate(
                ad_id=ad.id,
                variation_id=other_variation.id,
                client_id=client.id,
                quantity=1,
                sale_price=Decimal("99.00"),
                ordered_at=datetime.now(UTC),
            ),
        )


async def test_create_order_rejects_unknown_ad(db_session):
    company, user, _, variation, client, _ = await _scaffold(db_session)
    with pytest.raises(ValidationError):
        await create_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=OrderCreate(
                ad_id=uuid.uuid4(),
                variation_id=variation.id,
                client_id=client.id,
                quantity=1,
                sale_price=Decimal("99.00"),
                ordered_at=datetime.now(UTC),
            ),
        )


async def test_create_order_rejects_unknown_variation(db_session):
    company, user, _, _, client, ad = await _scaffold(db_session)
    with pytest.raises(ValidationError):
        await create_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=OrderCreate(
                ad_id=ad.id,
                variation_id=uuid.uuid4(),
                client_id=client.id,
                quantity=1,
                sale_price=Decimal("99.00"),
                ordered_at=datetime.now(UTC),
            ),
        )


async def test_create_order_rejects_unknown_client(db_session):
    company, user, _, variation, _, ad = await _scaffold(db_session)
    with pytest.raises(ValidationError):
        await create_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=OrderCreate(
                ad_id=ad.id,
                variation_id=variation.id,
                client_id=uuid.uuid4(),
                quantity=1,
                sale_price=Decimal("99.00"),
                ordered_at=datetime.now(UTC),
            ),
        )


async def test_create_order_rejects_other_tenant_ad(db_session):
    company_a, user_a, _, _, _, _ = await _scaffold(db_session)
    _company_b, _, _, variation_b, client_b, ad_b = await _scaffold(db_session)

    with pytest.raises(ValidationError):
        await create_order(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            payload=OrderCreate(
                ad_id=ad_b.id,
                variation_id=variation_b.id,
                client_id=client_b.id,
                quantity=1,
                sale_price=Decimal("99.00"),
                ordered_at=datetime.now(UTC),
            ),
        )


async def test_create_order_duplicate_external_id_per_ad_conflicts(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        external_order_id="DUP-1",
    )
    with pytest.raises(ConflictError):
        await create_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=OrderCreate(
                ad_id=ad.id,
                variation_id=variation.id,
                client_id=client.id,
                quantity=1,
                sale_price=Decimal("99.00"),
                ordered_at=datetime.now(UTC),
                external_order_id="DUP-1",
            ),
        )


# -------------------------------------------------------------------- get


async def test_get_order_returns_joined_data(db_session):
    company, _, product, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )

    row, _readiness = await get_order(db_session, company_id=company.id, order_id=order.id)
    (
        fetched_order,
        fetched_ad,
        fetched_variation,
        fetched_product,
        code,
        fetched_client,
        image_url,
        _shipping_label_url,
        _tracking_code,
    ) = row
    assert fetched_order.id == order.id
    assert fetched_ad.id == ad.id
    assert fetched_variation.id == variation.id
    assert fetched_product.id == product.id
    assert fetched_client.id == client.id
    assert code  # spec code surfaced
    assert image_url is None  # product has no print in scaffold


async def test_get_order_raises_not_found(db_session):
    company, _, _, _, _, _ = await _scaffold(db_session)
    with pytest.raises(NotFoundError):
        await get_order(db_session, company_id=company.id, order_id=uuid.uuid4())


async def test_get_order_does_not_leak_across_tenants(db_session):
    company_a, _, _, _, _, _ = await _scaffold(db_session)
    company_b, _, _, variation_b, client_b, ad_b = await _scaffold(db_session)
    foreign = await factory_create_order(
        db_session,
        company_id=company_b.id,
        ad_id=ad_b.id,
        variation_id=variation_b.id,
        client_id=client_b.id,
    )
    with pytest.raises(NotFoundError):
        await get_order(db_session, company_id=company_a.id, order_id=foreign.id)


# ------------------------------------------------------------------- list


async def test_list_orders_returns_only_tenant_rows(db_session):
    company_a, _, _, variation_a, client_a, ad_a = await _scaffold(db_session)
    company_b, _, _, variation_b, client_b, ad_b = await _scaffold(db_session)
    await factory_create_order(
        db_session,
        company_id=company_a.id,
        ad_id=ad_a.id,
        variation_id=variation_a.id,
        client_id=client_a.id,
    )
    await factory_create_order(
        db_session,
        company_id=company_b.id,
        ad_id=ad_b.id,
        variation_id=variation_b.id,
        client_id=client_b.id,
    )

    rows, total, _readiness = await list_orders(
        db_session, company_id=company_a.id, filters=OrderFilters(), page=PageParams()
    )
    assert total == 1
    assert rows[0][0].company_id == company_a.id


async def test_list_orders_filters_by_status(db_session):
    company, _, _, variation, client, ad = await _scaffold(db_session)
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PENDING,
    )
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PAID,
        external_order_id="A2",
    )

    rows, total, _readiness = await list_orders(
        db_session,
        company_id=company.id,
        filters=OrderFilters(status=OrderStatus.PAID),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0][0].status == OrderStatus.PAID


async def test_list_orders_filters_by_channel(db_session):
    company, _, product, variation, client, _ = await _scaffold(db_session)
    ad_a = await create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        ecommerce=Ecommerce.SHOPEE,
        title="A",
    )
    ad_b = await create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        ecommerce=Ecommerce.INSTAGRAM,
        title="B",
    )
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad_a.id,
        variation_id=variation.id,
        client_id=client.id,
    )
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad_b.id,
        variation_id=variation.id,
        client_id=client.id,
        external_order_id="B-1",
    )

    rows, total, _readiness = await list_orders(
        db_session,
        company_id=company.id,
        filters=OrderFilters(channel=Ecommerce.INSTAGRAM),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0][1].id == ad_b.id


async def test_list_orders_filters_by_client_and_ad(db_session):
    company, _, _, variation, client, ad = await _scaffold(db_session)
    other_client = await create_client(db_session, company_id=company.id)
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=other_client.id,
        external_order_id="O-2",
    )

    rows, total, _readiness = await list_orders(
        db_session,
        company_id=company.id,
        filters=OrderFilters(client_id=other_client.id),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0][5].id == other_client.id

    _rows2, total2, _readiness = await list_orders(
        db_session,
        company_id=company.id,
        filters=OrderFilters(ad_id=ad.id),
        page=PageParams(),
    )
    assert total2 == 2


async def test_list_orders_filters_by_search_text(db_session):
    company, _, _, variation, _, ad = await _scaffold(db_session)
    targeted = await create_client(db_session, company_id=company.id, name="Maria do Carmo")
    other = await create_client(db_session, company_id=company.id, name="Joao da Silva")
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=targeted.id,
        external_order_id="EXT-OK",
    )
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=other.id,
        external_order_id="NOMATCH",
    )

    rows, total, _readiness = await list_orders(
        db_session,
        company_id=company.id,
        filters=OrderFilters(q="maria"),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0][5].id == targeted.id

    # search by external_order_id substring
    _rows2, total2, _readiness = await list_orders(
        db_session,
        company_id=company.id,
        filters=OrderFilters(q="ext-ok"),
        page=PageParams(),
    )
    assert total2 == 1


async def test_list_orders_filters_by_date_range(db_session):
    company, _, _, variation, client, ad = await _scaffold(db_session)
    early = datetime(2024, 1, 1, tzinfo=UTC)
    late = datetime(2026, 6, 1, tzinfo=UTC)
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        ordered_at=early,
    )
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        ordered_at=late,
        external_order_id="L1",
    )

    rows, total, _readiness = await list_orders(
        db_session,
        company_id=company.id,
        filters=OrderFilters(date_from=datetime(2026, 1, 1, tzinfo=UTC)),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0][0].ordered_at == late

    rows2, total2, _readiness = await list_orders(
        db_session,
        company_id=company.id,
        filters=OrderFilters(date_to=datetime(2024, 12, 31, tzinfo=UTC)),
        page=PageParams(),
    )
    assert total2 == 1
    assert rows2[0][0].ordered_at == early


async def test_list_orders_filters_by_unbatched_and_batch_id(db_session):
    from models import Batch, BatchStatus

    company, _, _, variation, client, ad = await _scaffold(db_session)
    batched = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        external_order_id="B1",
    )
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        external_order_id="U1",
    )
    batch = Batch(company_id=company.id, code="BATCH-X", status=BatchStatus.OPEN)
    db_session.add(batch)
    await db_session.flush()
    batched.batch_id = batch.id
    db_session.add(batched)
    await db_session.commit()

    _rows, unbatched_total, _readiness = await list_orders(
        db_session,
        company_id=company.id,
        filters=OrderFilters(unbatched=True),
        page=PageParams(),
    )
    assert unbatched_total == 1

    rows, batch_total, _readiness = await list_orders(
        db_session,
        company_id=company.id,
        filters=OrderFilters(batch_id=batch.id),
        page=PageParams(),
    )
    assert batch_total == 1
    assert rows[0][0].id == batched.id


async def test_list_orders_filters_by_product_id(db_session):
    company, _, product, variation, client, ad = await _scaffold(db_session)
    # A second product (own spec/product/variation/ad) in the same company.
    spec2 = await create_product_spec(db_session, company_id=company.id)
    product2 = await create_product(db_session, company_id=company.id, spec_id=spec2.id)
    variation2 = await create_product_variation(db_session, company_id=company.id, product_id=product2.id)
    ad2 = await create_ad(db_session, company_id=company.id, product_id=product2.id)

    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        external_order_id="P1",
    )
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad2.id,
        variation_id=variation2.id,
        client_id=client.id,
        external_order_id="P2",
    )

    rows, total, _readiness = await list_orders(
        db_session,
        company_id=company.id,
        filters=OrderFilters(product_id=product.id),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0][3].id == product.id


async def test_list_orders_paginates(db_session):
    company, _, _, variation, client, ad = await _scaffold(db_session)
    for i in range(5):
        await factory_create_order(
            db_session,
            company_id=company.id,
            ad_id=ad.id,
            variation_id=variation.id,
            client_id=client.id,
            external_order_id=f"E{i}",
        )

    rows, total, _readiness = await list_orders(
        db_session,
        company_id=company.id,
        filters=OrderFilters(),
        page=PageParams(page=1, page_size=2),
    )
    assert total == 5
    assert len(rows) == 2

    rows_p3, _, _readiness = await list_orders(
        db_session,
        company_id=company.id,
        filters=OrderFilters(),
        page=PageParams(page=3, page_size=2),
    )
    assert len(rows_p3) == 1


# ----------------------------------------------------------------- update


async def test_update_order_changes_fields_and_audits(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
    )

    row, _readiness = await update_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=OrderUpdate(sale_price=Decimal("250.00"), quantity=3),
    )
    updated = row[0]
    assert updated.sale_price == Decimal("250.00")
    assert updated.quantity == 3

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == order.id))).all()
    assert any("sale_price" in a.message or "Edited order" in a.message for a in audits)


async def test_update_order_can_change_status(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PENDING,
    )

    row, _readiness = await update_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=OrderUpdate(status=OrderStatus.PAID),
    )
    assert row[0].status == OrderStatus.PAID


async def test_update_order_rejects_illegal_status_transition(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PENDING,
    )
    with pytest.raises(ConflictError):
        await update_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=order.id,
            payload=OrderUpdate(status=OrderStatus.SHIPPED),
        )


async def test_update_order_not_found(db_session):
    company, user, _, _, _, _ = await _scaffold(db_session)
    with pytest.raises(NotFoundError):
        await update_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=uuid.uuid4(),
            payload=OrderUpdate(sale_price=Decimal("9.00")),
        )


async def test_update_order_does_not_cross_tenants(db_session):
    company_a, user_a, _, _, _, _ = await _scaffold(db_session)
    company_b, _, _, variation_b, client_b, ad_b = await _scaffold(db_session)
    foreign = await factory_create_order(
        db_session,
        company_id=company_b.id,
        ad_id=ad_b.id,
        variation_id=variation_b.id,
        client_id=client_b.id,
    )
    with pytest.raises(NotFoundError):
        await update_order(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            order_id=foreign.id,
            payload=OrderUpdate(sale_price=Decimal("9.00")),
        )


async def test_update_order_duplicate_external_id_conflicts(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        external_order_id="TAKEN",
    )
    other = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        external_order_id="FREE",
    )
    with pytest.raises(ConflictError):
        await update_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=other.id,
            payload=OrderUpdate(external_order_id="TAKEN"),
        )


# ----------------------------------------------------------- transition


async def test_transition_to_paid_audits(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PENDING,
    )

    row, _readiness = await transition_status(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        target=OrderStatus.PAID,
    )
    assert row[0].status == OrderStatus.PAID

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == order.id))).all()
    assert any("PAID" in a.message for a in audits)


async def test_transition_to_shipped_creates_stock_exit(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PAID,
        quantity=3,
    )
    # Finished stock must cover the order before it can ship (T6 guard).
    await create_stock_entry(db_session, company_id=company.id, variation_id=variation.id, quantity=10)

    row, _readiness = await transition_status(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        target=OrderStatus.SHIPPED,
    )
    assert row[0].status == OrderStatus.SHIPPED

    exits = (await db_session.exec(select(StockExit).where(StockExit.order_id == order.id))).all()
    assert len(exits) == 1
    assert exits[0].quantity == 3
    assert exits[0].reason == StockExitReason.SALE


async def test_transition_to_shipped_idempotent_on_retry(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PAID,
    )
    # Finished stock must cover the order before it can ship (T6 guard).
    await create_stock_entry(db_session, company_id=company.id, variation_id=variation.id, quantity=10)
    # First transition.
    await transition_status(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        target=OrderStatus.SHIPPED,
    )
    # Apply the same transition again to confirm no double exit.
    await transition_status(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        target=OrderStatus.SHIPPED,
    )
    exits = (await db_session.exec(select(StockExit).where(StockExit.order_id == order.id))).all()
    assert len(exits) == 1


async def test_transition_to_shipped_skips_when_exit_already_present(db_session):
    """Defensive idempotency: if an exit row was injected out-of-band,
    transitioning to SHIPPED must not create a second one."""

    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PAID,
    )
    # Pre-create a stock exit before the transition.
    await create_stock_exit(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        order_id=order.id,
    )
    await transition_status(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        target=OrderStatus.SHIPPED,
    )
    exits = (await db_session.exec(select(StockExit).where(StockExit.order_id == order.id))).all()
    # Still exactly one exit (the manually-injected one); none was added.
    assert len(exits) == 1


async def test_transition_to_delivered_then_returned_writes_entry(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PAID,
        quantity=2,
    )
    # Finished stock must cover the order before it can ship (T6 guard).
    await create_stock_entry(db_session, company_id=company.id, variation_id=variation.id, quantity=10)
    await transition_status(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        target=OrderStatus.SHIPPED,
    )
    await transition_status(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        target=OrderStatus.DELIVERED,
    )
    row, _readiness = await transition_status(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        target=OrderStatus.RETURNED,
    )
    assert row[0].status == OrderStatus.RETURNED

    entries = (await db_session.exec(select(StockEntry).where(StockEntry.variation_id == variation.id))).all()
    return_entries = [e for e in entries if e.source == StockSource.RETURN]
    assert len(return_entries) == 1
    assert return_entries[0].quantity == 2


async def test_return_without_prior_exit_does_not_create_entry(db_session):
    """Cancelling a paid order then 'returning' it should not credit stock."""

    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PAID,
    )
    # Go straight to RETURNED — allowed from PAID. No exit existed, so no
    # entry should be created.
    await transition_status(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        target=OrderStatus.RETURNED,
    )
    return_entries = (await db_session.exec(select(StockEntry).where(StockEntry.variation_id == variation.id))).all()
    assert all(e.source != StockSource.RETURN for e in return_entries)


async def test_transition_rejects_illegal_jump(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PENDING,
    )
    with pytest.raises(ConflictError):
        await transition_status(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=order.id,
            target=OrderStatus.DELIVERED,
        )


async def test_transition_noop_returns_current(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PENDING,
    )
    row, _readiness = await transition_status(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        target=OrderStatus.PENDING,
    )
    assert row[0].status == OrderStatus.PENDING


async def test_transition_rejects_after_final(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.CANCELLED,
    )
    with pytest.raises(ConflictError):
        await transition_status(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=order.id,
            target=OrderStatus.PAID,
        )


async def test_transition_not_found(db_session):
    company, user, _, _, _, _ = await _scaffold(db_session)
    with pytest.raises(NotFoundError):
        await transition_status(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=uuid.uuid4(),
            target=OrderStatus.PAID,
        )


async def test_transition_does_not_cross_tenants(db_session):
    company_a, user_a, _, _, _, _ = await _scaffold(db_session)
    company_b, _, _, variation_b, client_b, ad_b = await _scaffold(db_session)
    foreign = await factory_create_order(
        db_session,
        company_id=company_b.id,
        ad_id=ad_b.id,
        variation_id=variation_b.id,
        client_id=client_b.id,
    )
    with pytest.raises(NotFoundError):
        await transition_status(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            order_id=foreign.id,
            target=OrderStatus.PAID,
        )


# ------------------------------------------------------------------- delete


async def test_delete_order_removes_row_and_audits(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.PENDING,
    )
    await delete_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
    )
    remaining = (await db_session.exec(select(Order).where(Order.id == order.id))).first()
    assert remaining is None

    audits = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == order.id))).all()
    assert any("Deleted order" in a.message for a in audits)


async def test_delete_order_blocked_when_stock_exit_exists(db_session):
    company, user, _, variation, client, ad = await _scaffold(db_session)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        status=OrderStatus.SHIPPED,
    )
    await create_stock_exit(
        db_session,
        company_id=company.id,
        variation_id=variation.id,
        order_id=order.id,
    )
    with pytest.raises(ConflictError):
        await delete_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=order.id,
        )
    still_there = (await db_session.exec(select(Order).where(Order.id == order.id))).first()
    assert still_there is not None


async def test_delete_order_raises_when_not_found(db_session):
    company, user, _, _, _, _ = await _scaffold(db_session)
    with pytest.raises(NotFoundError):
        await delete_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=uuid.uuid4(),
        )


async def test_delete_order_does_not_cross_tenants(db_session):
    company_a, user_a, _, _, _, _ = await _scaffold(db_session)
    company_b, _, _, variation_b, client_b, ad_b = await _scaffold(db_session)
    foreign = await factory_create_order(
        db_session,
        company_id=company_b.id,
        ad_id=ad_b.id,
        variation_id=variation_b.id,
        client_id=client_b.id,
    )
    with pytest.raises(NotFoundError):
        await delete_order(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            order_id=foreign.id,
        )
