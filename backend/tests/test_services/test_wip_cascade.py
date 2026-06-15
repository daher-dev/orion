"""End-to-end WIP cascade integration test for Phase 3 (T1 → T2 → T3).

Walks one spec+color through the three production transitions and asserts, after
each, both the source tier's on-hand AND the next tier's availability:

  T1  cutting → DONE       → fabric roll debited + cut pieces become available
  T2  remessa created      → cut availability drawn down (in transit at banca)
  T3  remessa received     → blank pieces credited (delta-only across partials)

This is the contract for the whole feature: stock flows out of one tier, credits
where a tier stores stock, and is instantly visible as input to the next tier.
"""

from datetime import UTC, date, datetime
from decimal import Decimal

from sqlmodel import select

from models import (
    BlankPiece,
    BlankPieceMovement,
    CuttingStatus,
    FabricRoll,
    FabricRollMovement,
    Size,
)
from schemas._common import PageParams
from schemas.blank_stock import BlankPieceLevelFilters
from schemas.cutting import AvailableCutsFilters, CuttingUpdate, OutputItem
from schemas.sewing import (
    ShipmentCreate,
    ShipmentItemInput,
    ShipmentItemReceiveInput,
    ShipmentReceiveBody,
)
from services import blank_stock as blank_stock_service
from services import cutting as cutting_service
from services import sewing as sewing_service
from tests.factories import (
    create_company,
    create_cutting_order,
    create_fabric_roll,
    create_product_spec,
    create_sewing_contractor,
    create_user,
)


async def _blank_on_hand(db_session, *, company_id, spec_id, size, color_code) -> int:
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
    return sum((-m.quantity if m.kind.value == "exit" else m.quantity) for m in movements)


async def test_full_cascade_t1_t2_t3(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    # Spec: 250 g/piece, no ribana. 20 pieces → 5.0 kg of body fabric.
    spec = await create_product_spec(
        db_session,
        company_id=company.id,
        code="CAM01",
        name="Camiseta Basic",
        fabric_weight_per_piece_g=Decimal("250.00"),
        has_ribana=False,
        ribana_weight_pct=None,
    )
    body = await create_fabric_roll(
        db_session,
        company_id=company.id,
        initial_weight_kg=Decimal("20.000"),
        current_weight_kg=Decimal("20.000"),
    )

    # A cutting order being cut (not yet DONE), planning 20 M pieces of "Preto".
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=body.id,
        color="Preto",
        color_code="PRT",
        status=CuttingStatus.CUTTING,
    )
    # Record the actual cut grade via the update path (also drives T1 on DONE).

    # ---- T1: transition to DONE ----
    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE, actual_outputs=[OutputItem(size=Size.M, quantity=20)]),
    )

    # Fabric roll debited 5.0 kg + a provenance EXIT movement written.
    refreshed_roll = (await db_session.exec(select(FabricRoll).where(FabricRoll.id == body.id))).first()
    assert refreshed_roll.current_weight_kg == Decimal("15.000")
    fabric_moves = list(
        (await db_session.exec(select(FabricRollMovement).where(FabricRollMovement.cutting_order_id == order.id))).all()
    )
    assert len(fabric_moves) == 1
    assert fabric_moves[0].quantity == Decimal("5.000")

    # Cut pieces are now available to sew (computed availability).
    avail = await cutting_service.available_by_size(db_session, company_id=company.id, cutting_order_id=order.id)
    assert avail[Size.M] == 20
    rows, total = await cutting_service.list_available_cuts(
        db_session, company_id=company.id, filters=AvailableCutsFilters(), page=PageParams()
    )
    assert total == 1
    assert rows[0]["total_available"] == 20

    # Blank in-production from open cutting is now 0 (the order is DONE).
    contractor = await create_sewing_contractor(db_session, company_id=company.id, name="Banca Z")

    # ---- T2: create a remessa for 12 pieces ----
    shipment = await sewing_service.create_shipment(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=ShipmentCreate(
            cutting_order_id=order.id,
            contractor_id=contractor.id,
            sent_at=date.today(),
            items=[ShipmentItemInput(size=Size.M, requested_quantity=12)],
        ),
    )
    assert shipment.status.value == "sent"

    # Availability drawn down: 20 - 12 = 8 remain.
    avail = await cutting_service.available_by_size(db_session, company_id=company.id, cutting_order_id=order.id)
    assert avail[Size.M] == 8

    # The 12 in transit count as blank in-production (open sewing).
    levels, _ = await blank_stock_service.list_levels(
        db_session, company_id=company.id, filters=BlankPieceLevelFilters(), page=PageParams()
    )
    # No blank piece row exists yet (nothing received), so in-production is not
    # yet surfaced on a level row — assert directly via the helper instead.
    in_prod = await blank_stock_service._in_production_map(
        db_session, company_id=company.id, keys={(spec.id, "PRT", Size.M)}
    )
    assert in_prod[(spec.id, "PRT", Size.M)] == 12

    # ---- T3a: first partial receive (5 of 12) ----
    await sewing_service.receive_shipment(
        db_session,
        company_id=company.id,
        user_id=user.id,
        shipment_id=shipment.id,
        payload=ShipmentReceiveBody(
            received_at=date.today(),
            items=[ShipmentItemReceiveInput(size=Size.M, received_quantity=5)],
        ),
    )
    assert await _blank_on_hand(db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color_code="PRT") == 5

    # in-production drops to 7 (12 requested - 5 received).
    in_prod = await blank_stock_service._in_production_map(
        db_session, company_id=company.id, keys={(spec.id, "PRT", Size.M)}
    )
    assert in_prod[(spec.id, "PRT", Size.M)] == 7

    # ---- T3b: second receive tops up to 12 → only +7 credited (delta-only) ----
    received = await sewing_service.receive_shipment(
        db_session,
        company_id=company.id,
        user_id=user.id,
        shipment_id=shipment.id,
        payload=ShipmentReceiveBody(
            received_at=date.today(),
            items=[ShipmentItemReceiveInput(size=Size.M, received_quantity=12)],
        ),
    )
    assert received.status.value == "received"
    assert await _blank_on_hand(db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color_code="PRT") == 12

    # Exactly two credit movements (5 then 7) — the first 5 were never re-credited.
    blank = (
        await db_session.exec(
            select(BlankPiece).where(
                BlankPiece.company_id == company.id,
                BlankPiece.spec_id == spec.id,
                BlankPiece.size == Size.M,
                BlankPiece.color_code == "PRT",
            )
        )
    ).first()
    movements = list(
        (
            await db_session.exec(
                select(BlankPieceMovement)
                .where(BlankPieceMovement.blank_piece_id == blank.id)
                .order_by(BlankPieceMovement.created_at.asc())  # type: ignore[attr-defined]
            )
        ).all()
    )
    assert [m.quantity for m in movements] == [5, 7]
    assert all(m.sewing_shipment_id == shipment.id for m in movements)

    # The fully-received remessa no longer contributes to in-production.
    in_prod = await blank_stock_service._in_production_map(
        db_session, company_id=company.id, keys={(spec.id, "PRT", Size.M)}
    )
    assert in_prod.get((spec.id, "PRT", Size.M), 0) == 0

    # Downstream blank-stock level now reflects 12 on-hand for the spec/color/size.
    levels, _ = await blank_stock_service.list_levels(
        db_session, company_id=company.id, filters=BlankPieceLevelFilters(), page=PageParams()
    )
    m_row = next(r for r in levels if r["spec_id"] == spec.id and r["size"] == Size.M and r["color_code"] == "PRT")
    assert m_row["on_hand"] == 12
    assert m_row["in_production"] == 0

    # Sanity: keep datetime import meaningful for any tz-aware assertions later.
    assert datetime.now(UTC) is not None
