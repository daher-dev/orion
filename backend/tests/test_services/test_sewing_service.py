import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import select

from models import (
    AuditLog,
    SewingShipment,
    SewingShipmentItem,
    ShipmentStatus,
    Size,
    StockEntry,
    StockSource,
)
from schemas._common import PageParams
from schemas.sewing import (
    ShipmentCreate,
    ShipmentFilters,
    ShipmentItemInput,
    ShipmentItemReceiveInput,
    ShipmentReceiveBody,
)
from services.sewing import (
    cancel_shipment,
    create_shipment,
    get_shipment,
    list_shipments,
    receive_shipment,
)
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import (
    create_company,
    create_cutting_order,
    create_fabric_roll,
    create_product,
    create_product_spec,
    create_product_variation,
    create_sewing_contractor,
    create_sewing_shipment,
    create_sewing_shipment_item,
    create_user,
)


# ---------- helpers ----------


async def _bootstrap_tenant(db_session):
    """Create a tenant with a product (P/M/G variations) + cutting order + contractor."""

    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    for size in (Size.P, Size.M, Size.G):
        await create_product_variation(
            db_session,
            company_id=company.id,
            product_id=product.id,
            size=size,
            color="Preto",
            color_code="BLK",
        )
    roll = await create_fabric_roll(db_session, company_id=company.id)
    cutting = await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=roll.id,
    )
    contractor = await create_sewing_contractor(
        db_session,
        company_id=company.id,
        name="Banca Alpha",
    )
    return {
        "company": company,
        "user": user,
        "product": product,
        "cutting": cutting,
        "contractor": contractor,
    }


async def _audits_for(db_session, *, resource_id: uuid.UUID) -> list[AuditLog]:
    result = await db_session.exec(
        select(AuditLog)
        .where(AuditLog.resource_id == resource_id, AuditLog.resource_type == "sewing_shipments")
        .order_by(AuditLog.created_at.asc())  # type: ignore[attr-defined]
    )
    return list(result.all())


def _today() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


# ---------- create_shipment ----------


async def test_create_shipment_happy_path(db_session):
    ctx = await _bootstrap_tenant(db_session)

    payload = ShipmentCreate(
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
        sent_at=_today().date(),
        items=[
            ShipmentItemInput(size=Size.P, requested_quantity=5),
            ShipmentItemInput(size=Size.M, requested_quantity=10),
            ShipmentItemInput(size=Size.G, requested_quantity=7),
        ],
    )

    result = await create_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        payload=payload,
    )

    assert result.id is not None
    assert result.status == ShipmentStatus.SENT
    assert result.received_at is None
    assert len(result.items) == 3
    by_size = {item.size: item for item in result.items}
    assert by_size[Size.P].requested_quantity == 5
    assert by_size[Size.M].received_quantity == 0
    assert result.cutting_order.id == ctx["cutting"].id
    assert result.cutting_order.code.startswith("OC-")
    assert result.contractor.name == "Banca Alpha"

    audits = await _audits_for(db_session, resource_id=result.id)
    assert audits and "Shipment created" in audits[0].message


async def test_create_shipment_rejects_duplicate_sizes(db_session):
    ctx = await _bootstrap_tenant(db_session)

    with pytest.raises(ValueError):
        ShipmentCreate(
            cutting_order_id=ctx["cutting"].id,
            contractor_id=ctx["contractor"].id,
            sent_at=_today().date(),
            items=[
                ShipmentItemInput(size=Size.M, requested_quantity=5),
                ShipmentItemInput(size=Size.M, requested_quantity=3),
            ],
        )


async def test_create_shipment_requires_at_least_one_positive_quantity(db_session):
    ctx = await _bootstrap_tenant(db_session)

    with pytest.raises(ValueError):
        ShipmentCreate(
            cutting_order_id=ctx["cutting"].id,
            contractor_id=ctx["contractor"].id,
            sent_at=_today().date(),
            items=[ShipmentItemInput(size=Size.M, requested_quantity=0)],
        )


async def test_create_shipment_404_when_contractor_missing(db_session):
    ctx = await _bootstrap_tenant(db_session)

    payload = ShipmentCreate(
        cutting_order_id=ctx["cutting"].id,
        contractor_id=uuid.uuid4(),
        sent_at=_today().date(),
        items=[ShipmentItemInput(size=Size.M, requested_quantity=5)],
    )

    with pytest.raises(NotFoundError):
        await create_shipment(
            db_session,
            company_id=ctx["company"].id,
            user_id=ctx["user"].id,
            payload=payload,
        )


async def test_create_shipment_404_when_cutting_order_missing(db_session):
    ctx = await _bootstrap_tenant(db_session)

    payload = ShipmentCreate(
        cutting_order_id=uuid.uuid4(),
        contractor_id=ctx["contractor"].id,
        sent_at=_today().date(),
        items=[ShipmentItemInput(size=Size.M, requested_quantity=5)],
    )

    with pytest.raises(NotFoundError):
        await create_shipment(
            db_session,
            company_id=ctx["company"].id,
            user_id=ctx["user"].id,
            payload=payload,
        )


async def test_create_shipment_cross_tenant_isolated(db_session):
    """Contractor from another tenant should be invisible."""

    other = await create_company(db_session)
    other_contractor = await create_sewing_contractor(
        db_session,
        company_id=other.id,
        name="Foreign",
    )
    ctx = await _bootstrap_tenant(db_session)

    payload = ShipmentCreate(
        cutting_order_id=ctx["cutting"].id,
        contractor_id=other_contractor.id,
        sent_at=_today().date(),
        items=[ShipmentItemInput(size=Size.M, requested_quantity=5)],
    )
    with pytest.raises(NotFoundError):
        await create_shipment(
            db_session,
            company_id=ctx["company"].id,
            user_id=ctx["user"].id,
            payload=payload,
        )


# ---------- get_shipment ----------


async def test_get_shipment_returns_match(db_session):
    ctx = await _bootstrap_tenant(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=10,
        received_quantity=0,
    )

    result = await get_shipment(
        db_session,
        company_id=ctx["company"].id,
        shipment_id=shipment.id,
    )
    assert result.id == shipment.id
    assert len(result.items) == 1
    assert result.items[0].requested_quantity == 10


async def test_get_shipment_not_found(db_session):
    ctx = await _bootstrap_tenant(db_session)
    with pytest.raises(NotFoundError):
        await get_shipment(
            db_session,
            company_id=ctx["company"].id,
            shipment_id=uuid.uuid4(),
        )


async def test_get_shipment_isolated_by_tenant(db_session):
    ctx_a = await _bootstrap_tenant(db_session)
    shipment_a = await create_sewing_shipment(
        db_session,
        company_id=ctx_a["company"].id,
        cutting_order_id=ctx_a["cutting"].id,
        contractor_id=ctx_a["contractor"].id,
    )

    company_b = await create_company(db_session)
    with pytest.raises(NotFoundError):
        await get_shipment(
            db_session,
            company_id=company_b.id,
            shipment_id=shipment_a.id,
        )


# ---------- list_shipments ----------


async def test_list_shipments_returns_paginated_results(db_session):
    ctx = await _bootstrap_tenant(db_session)
    for _ in range(3):
        s = await create_sewing_shipment(
            db_session,
            company_id=ctx["company"].id,
            cutting_order_id=ctx["cutting"].id,
            contractor_id=ctx["contractor"].id,
        )
        await create_sewing_shipment_item(
            db_session,
            shipment_id=s.id,
            size=Size.M,
            requested_quantity=4,
        )

    items, total = await list_shipments(
        db_session,
        company_id=ctx["company"].id,
        filters=ShipmentFilters(),
        page=PageParams(),
    )
    assert total == 3
    assert len(items) == 3


async def test_list_shipments_filter_by_status(db_session):
    ctx = await _bootstrap_tenant(db_session)
    await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
        status=ShipmentStatus.SENT,
    )
    await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
        status=ShipmentStatus.CANCELLED,
    )

    items, total = await list_shipments(
        db_session,
        company_id=ctx["company"].id,
        filters=ShipmentFilters(status=ShipmentStatus.CANCELLED),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].status == ShipmentStatus.CANCELLED


async def test_list_shipments_filter_by_contractor(db_session):
    ctx = await _bootstrap_tenant(db_session)
    other_contractor = await create_sewing_contractor(
        db_session,
        company_id=ctx["company"].id,
        name="Other Banca",
    )
    await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    target = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=other_contractor.id,
    )

    items, total = await list_shipments(
        db_session,
        company_id=ctx["company"].id,
        filters=ShipmentFilters(contractor_id=other_contractor.id),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].id == target.id


async def test_list_shipments_filter_by_cutting_order(db_session):
    ctx = await _bootstrap_tenant(db_session)
    roll2 = await create_fabric_roll(db_session, company_id=ctx["company"].id)
    second_cutting = await create_cutting_order(
        db_session,
        company_id=ctx["company"].id,
        product_id=ctx["product"].id,
        body_roll_id=roll2.id,
    )
    await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    target = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=second_cutting.id,
        contractor_id=ctx["contractor"].id,
    )

    items, total = await list_shipments(
        db_session,
        company_id=ctx["company"].id,
        filters=ShipmentFilters(cutting_order_id=second_cutting.id),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].id == target.id


async def test_list_shipments_search_by_contractor_name(db_session):
    ctx = await _bootstrap_tenant(db_session)
    other = await create_sewing_contractor(
        db_session,
        company_id=ctx["company"].id,
        name="Banca Bravo",
    )
    await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    target = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=other.id,
    )

    items, total = await list_shipments(
        db_session,
        company_id=ctx["company"].id,
        filters=ShipmentFilters(q="bravo"),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].id == target.id


async def test_list_shipments_pagination(db_session):
    ctx = await _bootstrap_tenant(db_session)
    for _ in range(5):
        await create_sewing_shipment(
            db_session,
            company_id=ctx["company"].id,
            cutting_order_id=ctx["cutting"].id,
            contractor_id=ctx["contractor"].id,
        )

    items, total = await list_shipments(
        db_session,
        company_id=ctx["company"].id,
        filters=ShipmentFilters(),
        page=PageParams(page=1, page_size=2),
    )
    assert total == 5
    assert len(items) == 2


async def test_list_shipments_isolated_by_tenant(db_session):
    ctx = await _bootstrap_tenant(db_session)
    other = await create_company(db_session)
    other_user = await create_user(db_session, company_id=other.id)
    other_spec = await create_product_spec(db_session, company_id=other.id)
    other_product = await create_product(db_session, company_id=other.id, spec_id=other_spec.id)
    other_roll = await create_fabric_roll(db_session, company_id=other.id)
    other_cutting = await create_cutting_order(
        db_session,
        company_id=other.id,
        product_id=other_product.id,
        body_roll_id=other_roll.id,
    )
    other_contractor = await create_sewing_contractor(
        db_session,
        company_id=other.id,
        name="Foreign Banca",
    )
    await create_sewing_shipment(
        db_session,
        company_id=other.id,
        cutting_order_id=other_cutting.id,
        contractor_id=other_contractor.id,
    )
    await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )

    items, total = await list_shipments(
        db_session,
        company_id=ctx["company"].id,
        filters=ShipmentFilters(),
        page=PageParams(),
    )
    assert total == 1

    # Sanity: also unused user just to keep linter happy
    assert other_user.company_id == other.id


async def test_list_shipments_empty_result(db_session):
    ctx = await _bootstrap_tenant(db_session)
    items, total = await list_shipments(
        db_session,
        company_id=ctx["company"].id,
        filters=ShipmentFilters(),
        page=PageParams(),
    )
    assert items == []
    assert total == 0


# ---------- receive_shipment ----------


async def test_receive_shipment_full_match_status_received(db_session):
    ctx = await _bootstrap_tenant(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    for size, qty in ((Size.P, 3), (Size.M, 5), (Size.G, 2)):
        await create_sewing_shipment_item(
            db_session,
            shipment_id=shipment.id,
            size=size,
            requested_quantity=qty,
            received_quantity=0,
        )

    received_date = _today().date() + timedelta(days=7)
    result = await receive_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        shipment_id=shipment.id,
        payload=ShipmentReceiveBody(
            received_at=received_date,
            items=[
                ShipmentItemReceiveInput(size=Size.P, received_quantity=3),
                ShipmentItemReceiveInput(size=Size.M, received_quantity=5),
                ShipmentItemReceiveInput(size=Size.G, received_quantity=2),
            ],
        ),
    )
    assert result.status == ShipmentStatus.RECEIVED
    assert result.received_at == received_date
    by_size = {it.size: it for it in result.items}
    assert by_size[Size.P].received_quantity == 3
    assert by_size[Size.M].received_quantity == 5
    assert by_size[Size.G].received_quantity == 2

    stock = list(
        (
            await db_session.exec(
                select(StockEntry).where(StockEntry.shipment_id == shipment.id)
            )
        ).all()
    )
    assert len(stock) == 3
    assert all(e.source == StockSource.SHIPMENT for e in stock)
    assert sum(e.quantity for e in stock) == 10

    audits = await _audits_for(db_session, resource_id=shipment.id)
    assert any("Received shipment" in a.message for a in audits)


async def test_receive_shipment_partial_status(db_session):
    ctx = await _bootstrap_tenant(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=10,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.G,
        requested_quantity=4,
    )

    result = await receive_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        shipment_id=shipment.id,
        payload=ShipmentReceiveBody(
            received_at=_today().date(),
            items=[
                ShipmentItemReceiveInput(size=Size.M, received_quantity=8),
                ShipmentItemReceiveInput(size=Size.G, received_quantity=4),
            ],
        ),
    )
    assert result.status == ShipmentStatus.PARTIAL
    stock = list(
        (
            await db_session.exec(
                select(StockEntry).where(StockEntry.shipment_id == shipment.id)
            )
        ).all()
    )
    assert sum(e.quantity for e in stock) == 12


async def test_receive_shipment_with_zero_quantity_skips_stock_for_that_size(db_session):
    ctx = await _bootstrap_tenant(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=5,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.G,
        requested_quantity=3,
    )

    result = await receive_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        shipment_id=shipment.id,
        payload=ShipmentReceiveBody(
            received_at=_today().date(),
            items=[
                ShipmentItemReceiveInput(size=Size.M, received_quantity=5),
                ShipmentItemReceiveInput(size=Size.G, received_quantity=0),
            ],
        ),
    )
    assert result.status == ShipmentStatus.PARTIAL

    stock = list(
        (
            await db_session.exec(
                select(StockEntry).where(StockEntry.shipment_id == shipment.id)
            )
        ).all()
    )
    assert len(stock) == 1
    assert stock[0].quantity == 5


async def test_receive_shipment_rejects_over_delivery(db_session):
    ctx = await _bootstrap_tenant(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=5,
    )

    with pytest.raises(ConflictError):
        await receive_shipment(
            db_session,
            company_id=ctx["company"].id,
            user_id=ctx["user"].id,
            shipment_id=shipment.id,
            payload=ShipmentReceiveBody(
                received_at=_today().date(),
                items=[ShipmentItemReceiveInput(size=Size.M, received_quantity=10)],
            ),
        )


async def test_receive_shipment_rejects_unknown_size(db_session):
    ctx = await _bootstrap_tenant(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=5,
    )

    with pytest.raises(ConflictError):
        await receive_shipment(
            db_session,
            company_id=ctx["company"].id,
            user_id=ctx["user"].id,
            shipment_id=shipment.id,
            payload=ShipmentReceiveBody(
                received_at=_today().date(),
                items=[ShipmentItemReceiveInput(size=Size.GG, received_quantity=3)],
            ),
        )


async def test_receive_shipment_double_receive_rejected(db_session):
    ctx = await _bootstrap_tenant(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=4,
    )

    payload = ShipmentReceiveBody(
        received_at=_today().date(),
        items=[ShipmentItemReceiveInput(size=Size.M, received_quantity=4)],
    )
    await receive_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        shipment_id=shipment.id,
        payload=payload,
    )

    with pytest.raises(ConflictError):
        await receive_shipment(
            db_session,
            company_id=ctx["company"].id,
            user_id=ctx["user"].id,
            shipment_id=shipment.id,
            payload=payload,
        )


async def test_receive_shipment_not_found(db_session):
    ctx = await _bootstrap_tenant(db_session)
    with pytest.raises(NotFoundError):
        await receive_shipment(
            db_session,
            company_id=ctx["company"].id,
            user_id=ctx["user"].id,
            shipment_id=uuid.uuid4(),
            payload=ShipmentReceiveBody(
                received_at=_today().date(),
                items=[ShipmentItemReceiveInput(size=Size.M, received_quantity=1)],
            ),
        )


def test_receive_body_rejects_duplicate_sizes():
    with pytest.raises(ValueError):
        ShipmentReceiveBody(
            received_at=_today().date(),
            items=[
                ShipmentItemReceiveInput(size=Size.M, received_quantity=1),
                ShipmentItemReceiveInput(size=Size.M, received_quantity=2),
            ],
        )


async def test_receive_shipment_rejects_when_variation_missing(db_session):
    """If the product has no variation for a received size, the call fails."""

    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    # Intentionally do NOT create any variation.
    roll = await create_fabric_roll(db_session, company_id=company.id)
    cutting = await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=roll.id,
    )
    contractor = await create_sewing_contractor(
        db_session,
        company_id=company.id,
        name="Sole",
    )
    shipment = await create_sewing_shipment(
        db_session,
        company_id=company.id,
        cutting_order_id=cutting.id,
        contractor_id=contractor.id,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=3,
    )

    with pytest.raises(ConflictError):
        await receive_shipment(
            db_session,
            company_id=company.id,
            user_id=user.id,
            shipment_id=shipment.id,
            payload=ShipmentReceiveBody(
                received_at=_today().date(),
                items=[ShipmentItemReceiveInput(size=Size.M, received_quantity=3)],
            ),
        )


# ---------- cancel_shipment ----------


async def test_cancel_shipment_happy_path(db_session):
    ctx = await _bootstrap_tenant(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )

    result = await cancel_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        shipment_id=shipment.id,
    )
    assert result.status == ShipmentStatus.CANCELLED

    audits = await _audits_for(db_session, resource_id=shipment.id)
    assert any("cancelled" in a.message.lower() for a in audits)


async def test_cancel_shipment_rejects_when_already_received(db_session):
    ctx = await _bootstrap_tenant(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
        status=ShipmentStatus.RECEIVED,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=5,
    )
    with pytest.raises(ConflictError):
        await cancel_shipment(
            db_session,
            company_id=ctx["company"].id,
            user_id=ctx["user"].id,
            shipment_id=shipment.id,
        )


async def test_cancel_shipment_not_found(db_session):
    ctx = await _bootstrap_tenant(db_session)
    with pytest.raises(NotFoundError):
        await cancel_shipment(
            db_session,
            company_id=ctx["company"].id,
            user_id=ctx["user"].id,
            shipment_id=uuid.uuid4(),
        )


async def test_cancel_shipment_isolated_by_tenant(db_session):
    ctx = await _bootstrap_tenant(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    other = await create_company(db_session)
    other_user = await create_user(db_session, company_id=other.id)
    with pytest.raises(NotFoundError):
        await cancel_shipment(
            db_session,
            company_id=other.id,
            user_id=other_user.id,
            shipment_id=shipment.id,
        )


# ---------- DB-level invariants ----------


async def test_create_persists_items_with_zero_received(db_session):
    """Sanity check: items go in with received_quantity = 0 from the persistence layer."""

    ctx = await _bootstrap_tenant(db_session)
    payload = ShipmentCreate(
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
        sent_at=_today().date(),
        items=[ShipmentItemInput(size=Size.M, requested_quantity=4)],
    )
    result = await create_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        payload=payload,
    )
    rows = list(
        (
            await db_session.exec(
                select(SewingShipmentItem).where(SewingShipmentItem.shipment_id == result.id)
            )
        ).all()
    )
    assert len(rows) == 1
    assert rows[0].received_quantity == 0


async def test_shipment_persisted_with_status_sent(db_session):
    ctx = await _bootstrap_tenant(db_session)
    payload = ShipmentCreate(
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
        sent_at=_today().date(),
        items=[ShipmentItemInput(size=Size.M, requested_quantity=2)],
    )
    result = await create_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        payload=payload,
    )
    row = (
        await db_session.exec(select(SewingShipment).where(SewingShipment.id == result.id))
    ).first()
    assert row is not None
    assert row.status == ShipmentStatus.SENT
