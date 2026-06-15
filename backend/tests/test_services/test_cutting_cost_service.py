"""Service tests for the per-run production cost record (CuttingRunCost).

Covers the cost math (fabric/ribana/trims/labor), price snapshotting,
divide-by-zero guards, and the delete-then-insert upsert behaviour on the
done→cutting→done re-transition.
"""

import uuid
from decimal import Decimal

import pytest
from sqlmodel import select

from models import CuttingRunCost, CuttingStatus, FabricRollKind, Size
from schemas.cutting import CuttingUpdate, OutputItem
from services import cutting as cutting_service
from shared.exceptions import NotFoundError
from tests.factories import (
    create_company,
    create_cutting_order,
    create_cutting_order_output,
    create_fabric_roll,
    create_product_spec,
    create_spec_trim,
    create_user,
)


async def _cost_rows(db_session, *, cutting_order_id: uuid.UUID) -> list[CuttingRunCost]:
    result = await db_session.exec(select(CuttingRunCost).where(CuttingRunCost.cutting_order_id == cutting_order_id))
    return list(result.all())


async def test_no_cost_row_before_done(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="CRP01")
    body = await create_fabric_roll(db_session, company_id=company.id)
    order = await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=10)

    # Transition only to CUTTING — no cost yet.
    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.CUTTING),
    )
    assert await _cost_rows(db_session, cutting_order_id=order.id) == []
    with pytest.raises(NotFoundError):
        await cutting_service.get_cutting_cost(db_session, company_id=company.id, order_id=order.id)


async def test_cost_computed_on_done_basic_math(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    # Defaults: weight_per_piece=250g, labor=12.00, no ribana. Roll price 38.00.
    spec = await create_product_spec(db_session, company_id=company.id, code="CRP01")
    body = await create_fabric_roll(db_session, company_id=company.id, price_per_kg=Decimal("38.00"))
    order = await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=20)
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.G, quantity=10)

    cost = await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )
    assert cost.status == CuttingStatus.DONE

    read = await cutting_service.get_cutting_cost(db_session, company_id=company.id, order_id=order.id)
    assert read.total_pieces == 30
    # 30 * 250g / 1000 = 7.5 kg body fabric.
    assert read.body_fabric_kg == pytest.approx(7.5)
    assert read.ribana_kg == pytest.approx(0.0)
    assert read.fabric_cost == pytest.approx(285.0)  # 7.5 * 38
    assert read.ribana_cost == pytest.approx(0.0)
    assert read.trims_cost == pytest.approx(0.0)
    assert read.labor_cost == pytest.approx(360.0)  # 30 * 12
    assert read.total_cost == pytest.approx(645.0)
    assert read.cost_per_piece == pytest.approx(21.5)  # 645 / 30
    assert read.yield_pieces_per_kg == pytest.approx(4.0)  # 30 / 7.5
    assert read.rib_price_per_kg is None


async def test_cost_with_trims(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="TRM01")
    # Two trims: 0.50 x1 + 1.00 x2 = 2.50 per piece.
    await create_spec_trim(db_session, spec_id=spec.id, unit_price=Decimal("0.50"), quantity=1)
    await create_spec_trim(db_session, spec_id=spec.id, unit_price=Decimal("1.00"), quantity=2)
    body = await create_fabric_roll(db_session, company_id=company.id, price_per_kg=Decimal("38.00"))
    order = await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=10)

    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )
    read = await cutting_service.get_cutting_cost(db_session, company_id=company.id, order_id=order.id)
    assert read.trims_cost == pytest.approx(25.0)  # 2.50 * 10 pieces


async def test_cost_with_ribana_uses_rib_roll_price(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(
        db_session,
        company_id=company.id,
        code="RIB01",
        has_ribana=True,
        ribana_weight_pct=Decimal("20.00"),
    )
    body = await create_fabric_roll(
        db_session, company_id=company.id, kind=FabricRollKind.BODY, price_per_kg=Decimal("38.00")
    )
    rib = await create_fabric_roll(
        db_session, company_id=company.id, kind=FabricRollKind.RIB, price_per_kg=Decimal("50.00")
    )
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=body.id,
        rib_roll_id=rib.id,
    )
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=20)

    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )
    read = await cutting_service.get_cutting_cost(db_session, company_id=company.id, order_id=order.id)
    # body_kg = 20 * 250/1000 = 5.0; ribana_kg = 5.0 * 20% = 1.0
    assert read.body_fabric_kg == pytest.approx(5.0)
    assert read.ribana_kg == pytest.approx(1.0)
    assert read.fabric_cost == pytest.approx(190.0)  # 5.0 * 38
    assert read.ribana_cost == pytest.approx(50.0)  # 1.0 * 50 (rib roll price)
    assert read.rib_price_per_kg == pytest.approx(50.0)
    # yield = 20 / (5.0 + 1.0) = 3.333
    assert read.yield_pieces_per_kg == pytest.approx(3.333, abs=0.001)


async def test_cost_with_ribana_no_rib_roll_falls_back_to_body_price(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(
        db_session,
        company_id=company.id,
        code="RIB02",
        has_ribana=True,
        ribana_weight_pct=Decimal("20.00"),
    )
    body = await create_fabric_roll(db_session, company_id=company.id, price_per_kg=Decimal("40.00"))
    order = await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=20)

    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )
    read = await cutting_service.get_cutting_cost(db_session, company_id=company.id, order_id=order.id)
    # ribana priced at body price (no rib roll): 1.0 kg * 40 = 40.00
    assert read.ribana_cost == pytest.approx(40.0)
    assert read.rib_price_per_kg is None  # no rib roll → no snapshot


async def test_cost_is_frozen_snapshot_when_roll_price_changes(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="FRZ01")
    body = await create_fabric_roll(db_session, company_id=company.id, price_per_kg=Decimal("38.00"))
    order = await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=10)
    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )
    before = await cutting_service.get_cutting_cost(db_session, company_id=company.id, order_id=order.id)

    # Mutate the roll price + spec labor after the run is frozen.
    body.price_per_kg = Decimal("99.00")
    spec.labor_cost = Decimal("999.00")
    db_session.add(body)
    db_session.add(spec)
    await db_session.commit()

    after = await cutting_service.get_cutting_cost(db_session, company_id=company.id, order_id=order.id)
    assert after.body_price_per_kg == pytest.approx(before.body_price_per_kg)
    assert after.fabric_cost == pytest.approx(before.fabric_cost)
    assert after.labor_cost == pytest.approx(before.labor_cost)
    assert after.total_cost == pytest.approx(before.total_cost)


async def test_cost_zero_pieces_no_divide_by_zero(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="ZER01")
    body = await create_fabric_roll(db_session, company_id=company.id)
    order = await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
    # No outputs at all → 0 pieces.
    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )
    read = await cutting_service.get_cutting_cost(db_session, company_id=company.id, order_id=order.id)
    assert read.total_pieces == 0
    assert read.cost_per_piece == pytest.approx(0.0)
    assert read.yield_pieces_per_kg == pytest.approx(0.0)
    assert read.total_cost == pytest.approx(0.0)


async def test_revert_then_redone_upserts_single_row(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="UPS01")
    body = await create_fabric_roll(db_session, company_id=company.id, price_per_kg=Decimal("38.00"))
    order = await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=10)

    # done → cutting → done, recomputing actuals on the second DONE.
    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )
    assert len(await _cost_rows(db_session, cutting_order_id=order.id)) == 1

    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.CUTTING),
    )
    # Reverting keeps the last computed cost row.
    assert len(await _cost_rows(db_session, cutting_order_id=order.id)) == 1

    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(
            status=CuttingStatus.DONE,
            actual_outputs=[OutputItem(size=Size.M, quantity=20)],
        ),
    )
    rows = await _cost_rows(db_session, cutting_order_id=order.id)
    assert len(rows) == 1  # UNIQUE holds; upserted, not duplicated.
    assert rows[0].total_pieces == 20  # recomputed from the new actuals


async def test_get_cost_unknown_order_404(db_session):
    company = await create_company(db_session)
    with pytest.raises(NotFoundError):
        await cutting_service.get_cutting_cost(db_session, company_id=company.id, order_id=uuid.uuid4())


async def test_get_cost_isolated_by_tenant(db_session):
    company_a = await create_company(db_session)
    user_a = await create_user(db_session, company_id=company_a.id)
    spec = await create_product_spec(db_session, company_id=company_a.id, code="TEN01")
    body = await create_fabric_roll(db_session, company_id=company_a.id)
    order = await create_cutting_order(db_session, company_id=company_a.id, spec_id=spec.id, body_roll_id=body.id)
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=5)
    await cutting_service.update_cutting_order(
        db_session,
        company_id=company_a.id,
        user_id=user_a.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )

    company_b = await create_company(db_session)
    with pytest.raises(NotFoundError):
        await cutting_service.get_cutting_cost(db_session, company_id=company_b.id, order_id=order.id)
