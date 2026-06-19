"""Dashboard operator (factory-floor) section.

Covers the queue counts, the "pieces produced today" sum (cutting outputs whose
order was cut today), the incoming-shipments count, and the cutting queue list.
"""

from datetime import UTC, datetime, timedelta

from models import CuttingStatus, ShipmentStatus, Size
from services.dashboard import get_summary
from tests.factories import (
    create_company,
    create_cutting_order,
    create_cutting_order_output,
    create_product_spec,
    create_sewing_contractor,
    create_sewing_shipment,
)


async def test_operator_section_counts(db_session):
    company = await create_company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")

    # Queue: 2 pending + 1 cutting = 3; a DONE order is excluded from the queue.
    co_pending = await create_cutting_order(
        db_session, company_id=company.id, spec_id=spec.id, status=CuttingStatus.PENDING, color_code="PRT"
    )
    await create_cutting_order(
        db_session, company_id=company.id, spec_id=spec.id, status=CuttingStatus.CUTTING, color_code="WHT"
    )
    await create_cutting_order(
        db_session, company_id=company.id, spec_id=spec.id, status=CuttingStatus.PENDING, color_code="AZL"
    )

    # Cut today (DONE, cut_at now): outputs count toward pieces_today.
    co_today = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        status=CuttingStatus.DONE,
        cut_at=datetime.now(UTC),
        color_code="VRD",
    )
    await create_cutting_order_output(db_session, cutting_order_id=co_today.id, size=Size.M, quantity=12)
    await create_cutting_order_output(db_session, cutting_order_id=co_today.id, size=Size.G, quantity=8)

    # Cut two days ago: must NOT count toward pieces_today.
    co_old = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        status=CuttingStatus.DONE,
        cut_at=datetime.now(UTC) - timedelta(days=2),
        color_code="CIN",
    )
    await create_cutting_order_output(db_session, cutting_order_id=co_old.id, size=Size.M, quantity=100)

    # Incoming shipments: SENT + PARTIAL count; RECEIVED does not.
    contractor = await create_sewing_contractor(db_session, company_id=company.id)
    await create_sewing_shipment(
        db_session,
        company_id=company.id,
        cutting_order_id=co_today.id,
        contractor_id=contractor.id,
        status=ShipmentStatus.SENT,
    )
    await create_sewing_shipment(
        db_session,
        company_id=company.id,
        cutting_order_id=co_old.id,
        contractor_id=contractor.id,
        status=ShipmentStatus.PARTIAL,
    )
    await create_sewing_shipment(
        db_session,
        company_id=company.id,
        cutting_order_id=co_pending.id,
        contractor_id=contractor.id,
        status=ShipmentStatus.RECEIVED,
    )

    op = (await get_summary(db_session, company_id=company.id)).operator
    assert op.cuts_in_queue == 3
    assert op.shipments_incoming == 2
    assert op.pieces_today == 20  # 12 + 8; the 2-days-ago 100 is excluded
    # Queue list: only pending/cutting orders surface, capped at five.
    assert len(op.cutting_queue) == 3
    assert {cut.status for cut in op.cutting_queue} <= {"pending", "cutting"}
    assert {cut.code for cut in op.cutting_queue} == {"CAM01"}
    assert {cut.color for cut in op.cutting_queue} == {"Preto"}


async def test_operator_queue_capped_at_five(db_session):
    company = await create_company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    for _ in range(7):
        await create_cutting_order(
            db_session, company_id=company.id, spec_id=spec.id, status=CuttingStatus.PENDING, color_code="PRT"
        )

    op = (await get_summary(db_session, company_id=company.id)).operator
    assert op.cuts_in_queue == 7
    assert len(op.cutting_queue) == 5


async def test_operator_tenant_isolation(db_session):
    company = await create_company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    await create_cutting_order(
        db_session, company_id=company.id, spec_id=spec.id, status=CuttingStatus.PENDING, color_code="PRT"
    )

    other = await create_company(db_session)
    other_spec = await create_product_spec(db_session, company_id=other.id, code="CAM02")
    for _ in range(5):
        await create_cutting_order(
            db_session, company_id=other.id, spec_id=other_spec.id, status=CuttingStatus.PENDING, color_code="WHT"
        )

    op = (await get_summary(db_session, company_id=company.id)).operator
    assert op.cuts_in_queue == 1
    assert len(op.cutting_queue) == 1
