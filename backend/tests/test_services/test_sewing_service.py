import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import select

from models import (
    AuditLog,
    BlankPiece,
    BlankPieceMovement,
    CuttingStatus,
    SewingShipment,
    SewingShipmentItem,
    ShipmentStatus,
    Size,
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
    create_cutting_order_output,
    create_fabric_roll,
    create_product,
    create_product_spec,
    create_sewing_contractor,
    create_sewing_shipment,
    create_sewing_shipment_item,
    create_user,
)

# ---------- helpers ----------


async def _bootstrap_tenant(db_session, *, cutting_status=CuttingStatus.DONE, outputs=None):
    """Create a tenant with a spec-keyed DONE cutting order (+outputs) + contractor.

    Cutting is print-agnostic now, so the shipment draws from the cutting
    order's outputs (available cut pieces), not product variations. The order
    defaults to DONE so T2 (create) is allowed; pass ``cutting_status`` to
    override. ``outputs`` is a ``{Size: qty}`` map of cut pieces available to
    sew (defaults to generous P/M/G/GG so existing requested quantities fit).
    """

    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    roll = await create_fabric_roll(db_session, company_id=company.id)
    cutting = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=roll.id,
        color="Preto",
        color_code="PRT",
        status=cutting_status,
    )
    grade = outputs if outputs is not None else {Size.P: 100, Size.M: 100, Size.G: 100, Size.GG: 100}
    for size, qty in grade.items():
        await create_cutting_order_output(
            db_session,
            cutting_order_id=cutting.id,
            size=size,
            quantity=qty,
        )
    contractor = await create_sewing_contractor(
        db_session,
        company_id=company.id,
        name="Banca Alpha",
    )
    return {
        "company": company,
        "user": user,
        "spec": spec,
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


async def _blank_on_hand(db_session, *, company_id, spec_id, size, color_code) -> int:
    """Live blank on-hand for a (spec, size, color_code) key (signed ledger sum)."""

    piece = (
        await db_session.exec(
            select(BlankPiece).where(
                BlankPiece.company_id == company_id,
                BlankPiece.spec_id == spec_id,
                BlankPiece.size == size,
                BlankPiece.color_code == color_code,
            )
        )
    ).first()
    if piece is None:
        return 0
    movements = list(
        (await db_session.exec(select(BlankPieceMovement).where(BlankPieceMovement.blank_piece_id == piece.id))).all()
    )
    on_hand = 0
    for m in movements:
        on_hand += -m.quantity if m.kind.value == "exit" else m.quantity
    return on_hand


def _today() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


# ---------- create_shipment (T2) ----------


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
    assert by_size[Size.M].credited_quantity == 0
    assert result.cutting_order.id == ctx["cutting"].id
    assert result.cutting_order.code.startswith("OC-")
    assert result.contractor.name == "Banca Alpha"

    audits = await _audits_for(db_session, resource_id=result.id)
    assert audits and "Shipment created" in audits[0].message


async def test_create_shipment_requires_done_cutting_order(db_session):
    ctx = await _bootstrap_tenant(db_session, cutting_status=CuttingStatus.CUTTING)
    payload = ShipmentCreate(
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
        sent_at=_today().date(),
        items=[ShipmentItemInput(size=Size.M, requested_quantity=5)],
    )
    with pytest.raises(ConflictError) as exc:
        await create_shipment(
            db_session,
            company_id=ctx["company"].id,
            user_id=ctx["user"].id,
            payload=payload,
        )
    assert "done" in str(exc.value.detail).lower()


async def test_create_shipment_rejects_over_available(db_session):
    """T2 draws down availability: requesting more than the cut grade is a 409."""

    ctx = await _bootstrap_tenant(db_session, outputs={Size.M: 8})
    payload = ShipmentCreate(
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
        sent_at=_today().date(),
        items=[ShipmentItemInput(size=Size.M, requested_quantity=9)],
    )
    with pytest.raises(ConflictError) as exc:
        await create_shipment(
            db_session,
            company_id=ctx["company"].id,
            user_id=ctx["user"].id,
            payload=payload,
        )
    assert "exceeds available" in str(exc.value.detail).lower()


async def test_create_shipment_second_remessa_consumes_availability(db_session):
    """A first sent remessa reduces what a second can request."""

    ctx = await _bootstrap_tenant(db_session, outputs={Size.M: 10})
    await create_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        payload=ShipmentCreate(
            cutting_order_id=ctx["cutting"].id,
            contractor_id=ctx["contractor"].id,
            sent_at=_today().date(),
            items=[ShipmentItemInput(size=Size.M, requested_quantity=7)],
        ),
    )
    # Only 3 remain — a request for 4 must fail.
    with pytest.raises(ConflictError):
        await create_shipment(
            db_session,
            company_id=ctx["company"].id,
            user_id=ctx["user"].id,
            payload=ShipmentCreate(
                cutting_order_id=ctx["cutting"].id,
                contractor_id=ctx["contractor"].id,
                sent_at=_today().date(),
                items=[ShipmentItemInput(size=Size.M, requested_quantity=4)],
            ),
        )
    # 3 fits.
    ok = await create_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        payload=ShipmentCreate(
            cutting_order_id=ctx["cutting"].id,
            contractor_id=ctx["contractor"].id,
            sent_at=_today().date(),
            items=[ShipmentItemInput(size=Size.M, requested_quantity=3)],
        ),
    )
    assert ok.status == ShipmentStatus.SENT


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
    assert result.items[0].credited_quantity == 0


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
        spec_id=ctx["spec"].id,
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
    other_roll = await create_fabric_roll(db_session, company_id=other.id)
    other_cutting = await create_cutting_order(
        db_session,
        company_id=other.id,
        spec_id=other_spec.id,
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

    _items, total = await list_shipments(
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


# ---------- receive_shipment (T3) ----------


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
    # Credited watermark advanced to received.
    assert all(it.credited_quantity == it.received_quantity for it in result.items)

    # Blank pieces credited per size on the cutting order's spec+color key.
    async def _oh(size):
        return await _blank_on_hand(
            db_session, company_id=ctx["company"].id, spec_id=ctx["spec"].id, size=size, color_code="PRT"
        )

    assert await _oh(Size.P) == 3
    assert await _oh(Size.M) == 5
    assert await _oh(Size.G) == 2

    # Provenance is set on the credit movements.
    movements = list(
        (
            await db_session.exec(
                select(BlankPieceMovement).where(BlankPieceMovement.sewing_shipment_id == shipment.id)
            )
        ).all()
    )
    assert len(movements) == 3
    assert all(m.sewing_shipment_id == shipment.id for m in movements)

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
    spec_id = ctx["spec"].id

    async def _oh(size):
        return await _blank_on_hand(
            db_session, company_id=ctx["company"].id, spec_id=spec_id, size=size, color_code="PRT"
        )

    assert (await _oh(Size.M)) + (await _oh(Size.G)) == 12


async def test_receive_shipment_delta_only_across_two_partials(db_session):
    """The core T3 invariant: re-receiving credits ONLY the new delta per line."""

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
    spec_id = ctx["spec"].id

    async def _oh_m():
        return await _blank_on_hand(
            db_session, company_id=ctx["company"].id, spec_id=spec_id, size=Size.M, color_code="PRT"
        )

    # First partial receive: 4 of 10.
    first = await receive_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        shipment_id=shipment.id,
        payload=ShipmentReceiveBody(
            received_at=_today().date(),
            items=[ShipmentItemReceiveInput(size=Size.M, received_quantity=4)],
        ),
    )
    assert first.status == ShipmentStatus.PARTIAL
    assert first.items[0].credited_quantity == 4
    assert await _oh_m() == 4

    # Second receive: top up to 10 → only +6 credited (delta-only).
    second = await receive_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        shipment_id=shipment.id,
        payload=ShipmentReceiveBody(
            received_at=_today().date(),
            items=[ShipmentItemReceiveInput(size=Size.M, received_quantity=10)],
        ),
    )
    assert second.status == ShipmentStatus.RECEIVED
    assert second.items[0].credited_quantity == 10
    assert await _oh_m() == 10

    # Exactly two credit movements (4 then 6), never re-crediting the first 4.
    movements = list(
        (
            await db_session.exec(
                select(BlankPieceMovement)
                .where(BlankPieceMovement.sewing_shipment_id == shipment.id)
                .order_by(BlankPieceMovement.created_at.asc())  # type: ignore[attr-defined]
            )
        ).all()
    )
    assert [m.quantity for m in movements] == [4, 6]


async def test_receive_shipment_rereceive_omitted_sizes_retained(db_session):
    """A re-receive that omits a size keeps that size's prior received quantity."""

    ctx = await _bootstrap_tenant(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(db_session, shipment_id=shipment.id, size=Size.M, requested_quantity=6)
    await create_sewing_shipment_item(db_session, shipment_id=shipment.id, size=Size.G, requested_quantity=6)

    # Receive M fully.
    await receive_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        shipment_id=shipment.id,
        payload=ShipmentReceiveBody(
            received_at=_today().date(),
            items=[ShipmentItemReceiveInput(size=Size.M, received_quantity=6)],
        ),
    )
    # Now receive only G — M must NOT reset to 0.
    result = await receive_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        shipment_id=shipment.id,
        payload=ShipmentReceiveBody(
            received_at=_today().date(),
            items=[ShipmentItemReceiveInput(size=Size.G, received_quantity=6)],
        ),
    )
    by_size = {it.size: it for it in result.items}
    assert by_size[Size.M].received_quantity == 6
    assert by_size[Size.G].received_quantity == 6
    assert result.status == ShipmentStatus.RECEIVED


async def test_receive_shipment_reduce_below_credited_rejected(db_session):
    """Lowering received below an already-credited amount is a 409 (no negative credit)."""

    ctx = await _bootstrap_tenant(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(db_session, shipment_id=shipment.id, size=Size.M, requested_quantity=10)

    await receive_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        shipment_id=shipment.id,
        payload=ShipmentReceiveBody(
            received_at=_today().date(),
            items=[ShipmentItemReceiveInput(size=Size.M, received_quantity=6)],
        ),
    )
    with pytest.raises(ConflictError) as exc:
        await receive_shipment(
            db_session,
            company_id=ctx["company"].id,
            user_id=ctx["user"].id,
            shipment_id=shipment.id,
            payload=ShipmentReceiveBody(
                received_at=_today().date(),
                items=[ShipmentItemReceiveInput(size=Size.M, received_quantity=3)],
            ),
        )
    assert "credited" in str(exc.value.detail).lower()


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


async def test_receive_shipment_already_received_rejected(db_session):
    """A fully-received shipment cannot be received again."""

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
    received = await receive_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        shipment_id=shipment.id,
        payload=payload,
    )
    assert received.status == ShipmentStatus.RECEIVED

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


async def test_receive_shipment_creates_blank_piece_when_absent(db_session):
    """T3 resolves/creates the blank piece keyed by the cutting order's spec+color."""

    ctx = await _bootstrap_tenant(db_session)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=ctx["company"].id,
        cutting_order_id=ctx["cutting"].id,
        contractor_id=ctx["contractor"].id,
    )
    await create_sewing_shipment_item(db_session, shipment_id=shipment.id, size=Size.M, requested_quantity=3)

    # No blank piece exists yet for this spec/size/color.
    before = (
        await db_session.exec(
            select(BlankPiece).where(
                BlankPiece.company_id == ctx["company"].id,
                BlankPiece.spec_id == ctx["spec"].id,
                BlankPiece.size == Size.M,
            )
        )
    ).first()
    assert before is None

    await receive_shipment(
        db_session,
        company_id=ctx["company"].id,
        user_id=ctx["user"].id,
        shipment_id=shipment.id,
        payload=ShipmentReceiveBody(
            received_at=_today().date(),
            items=[ShipmentItemReceiveInput(size=Size.M, received_quantity=3)],
        ),
    )

    after = (
        await db_session.exec(
            select(BlankPiece).where(
                BlankPiece.company_id == ctx["company"].id,
                BlankPiece.spec_id == ctx["spec"].id,
                BlankPiece.size == Size.M,
            )
        )
    ).first()
    assert after is not None
    assert after.color == "Preto"
    assert after.color_code == "PRT"


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
        (await db_session.exec(select(SewingShipmentItem).where(SewingShipmentItem.shipment_id == result.id))).all()
    )
    assert len(rows) == 1
    assert rows[0].received_quantity == 0
    assert rows[0].credited_quantity == 0


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
    row = (await db_session.exec(select(SewingShipment).where(SewingShipment.id == result.id))).first()
    assert row is not None
    assert row.status == ShipmentStatus.SENT


# Keep create_product importable for cross-feature parity even though sewing no
# longer keys off products; referenced here so the import isn't flagged unused.
_ = create_product
