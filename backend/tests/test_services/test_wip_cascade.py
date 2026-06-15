"""End-to-end WIP cascade integration test for Phases 3-4 (T1 -> T2 -> T3 -> T4 -> T5).

Walks one spec+color through the production transitions and asserts, after each,
both the source tier's on-hand AND the next tier's availability:

  T1  cutting → DONE        → fabric roll debited + cut pieces become available
  T2  remessa created       → cut availability drawn down (in transit at banca)
  T3  remessa received      → blank pieces credited (delta-only across partials)
  T4  print order complete  → paper meters debited + printed transfers credited
  T5  assembly run          → blank + printed debited + finished SKU credited

This is the contract for the whole feature: stock flows out of one tier, credits
where a tier stores stock, and is instantly visible as input to the next tier.
"""

from datetime import UTC, date, datetime
from decimal import Decimal

from sqlmodel import select

from models import (
    AssemblyRun,
    BlankPiece,
    BlankPieceMovement,
    CuttingStatus,
    FabricRoll,
    FabricRollMovement,
    PaperRoll,
    PaperRollMovement,
    PaperType,
    PrintedTransfer,
    PrintedTransferMovement,
    PrintOrderStatus,
    PrintSide,
    PrintTechnique,
    ProductVariation,
    Size,
    StockEntry,
    StockSource,
)
from schemas._common import PageParams
from schemas.assembly import AssembleBody
from schemas.blank_stock import BlankPieceLevelFilters
from schemas.cutting import AvailableCutsFilters, CuttingUpdate, OutputItem
from schemas.print_order import (
    PrintOrderComplete,
    PrintOrderCreate,
    PrintOrderOutputItem,
    PrintOrderOutputItem2,
    PrintOrderUpdate,
)
from schemas.sewing import (
    ShipmentCreate,
    ShipmentItemInput,
    ShipmentItemReceiveInput,
    ShipmentReceiveBody,
)
from services import assembly as assembly_service
from services import blank_stock as blank_stock_service
from services import cutting as cutting_service
from services import print_order as print_order_service
from services import printed_transfer as printed_transfer_service
from services import sewing as sewing_service
from shared.exceptions import ConflictError
from tests.factories import (
    create_company,
    create_cutting_order,
    create_fabric_roll,
    create_paper_roll,
    create_print_design,
    create_print_design_variation,
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


# --------------------------------------------------------------- T3 end-state seed


async def _seed_t3_end_state(db_session):
    """Walk T1→T3 to the contract's end-state: 12 blank CAM01/PRT/M on hand.

    Returns ``(company, user, spec, blank)``. Reuses the exact spec+color+size
    walk asserted in :func:`test_full_cascade_t1_t2_t3` so T4→T5 continues from
    the same shop-floor position.
    """

    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
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
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=body.id,
        color="Preto",
        color_code="PRT",
        status=CuttingStatus.CUTTING,
    )
    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE, actual_outputs=[OutputItem(size=Size.M, quantity=20)]),
    )
    contractor = await create_sewing_contractor(db_session, company_id=company.id, name="Banca Z")
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
    await sewing_service.receive_shipment(
        db_session,
        company_id=company.id,
        user_id=user.id,
        shipment_id=shipment.id,
        payload=ShipmentReceiveBody(
            received_at=date.today(),
            items=[ShipmentItemReceiveInput(size=Size.M, received_quantity=12)],
        ),
    )
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
    assert blank is not None
    return company, user, spec, blank


async def test_full_cascade_t4_t5(db_session):
    """Continue the spec+color+size walk into T4 (print) → T5 (assembly)."""

    company, user, spec, blank = await _seed_t3_end_state(db_session)
    assert await _blank_on_hand(db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color_code="PRT") == 12

    # A DTF estampa with one ink variation + a DTF film roll (100 m).
    design = await create_print_design(
        db_session,
        company_id=company.id,
        code="FLR03",
        name="Floral",
        technique=PrintTechnique.DTF,
        has_front=True,
        has_back=False,
    )
    variation = await create_print_design_variation(
        db_session, company_id=company.id, print_design_id=design.id, name="Preto", ink_hex="#1f1f1f"
    )
    roll = await create_paper_roll(
        db_session,
        company_id=company.id,
        paper_type=PaperType.DTF_FILM,
        initial_meters=Decimal("100.00"),
        current_meters=Decimal("100.00"),
    )

    # ---- T4a: create a print order with a planned front output ----
    created = await print_order_service.create_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintOrderCreate(
            print_design_id=design.id,
            paper_roll_id=roll.id,
            planned_outputs=[
                PrintOrderOutputItem(print_design_variation_id=variation.id, side=PrintSide.FRONT, planned_quantity=12)
            ],
        ),
    )
    assert created.status == PrintOrderStatus.PENDING
    assert created.total_planned == 12
    assert created.rate_m_per_piece == 0.35

    # ---- T4b: record printed counts (12 front) via PATCH ----
    await print_order_service.update_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=created.id,
        payload=PrintOrderUpdate(
            status=PrintOrderStatus.PRINTING,
            printed_outputs=[
                PrintOrderOutputItem2(print_design_variation_id=variation.id, side=PrintSide.FRONT, printed_quantity=12)
            ],
        ),
    )

    # PATCH to printing posts nothing — paper untouched, no printed transfer yet.
    roll_mid = (await db_session.exec(select(PaperRoll).where(PaperRoll.id == roll.id))).first()
    assert roll_mid.current_meters == Decimal("100.00")

    # ---- T4c: complete ("Lançar impressos") ----
    completed = await print_order_service.complete_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=created.id,
        payload=PrintOrderComplete(),
    )
    assert completed.status == PrintOrderStatus.DONE
    assert completed.printed_at is not None
    assert completed.total_printed == 12

    # Paper debited 0.35 * 12 = 4.20 m, clamp-safe, with one EXIT movement.
    refreshed_roll = (await db_session.exec(select(PaperRoll).where(PaperRoll.id == roll.id))).first()
    assert refreshed_roll.current_meters == Decimal("95.80")
    paper_moves = list(
        (await db_session.exec(select(PaperRollMovement).where(PaperRollMovement.print_order_id == created.id))).all()
    )
    assert len(paper_moves) == 1
    assert paper_moves[0].quantity == Decimal("4.200")

    # Printed transfer (design, front) credited 12 — instantly visible downstream.
    transfer = (
        await db_session.exec(
            select(PrintedTransfer).where(
                PrintedTransfer.company_id == company.id,
                PrintedTransfer.print_design_id == design.id,
                PrintedTransfer.side == PrintSide.FRONT,
            )
        )
    ).first()
    assert transfer is not None
    printed_on_hand = await printed_transfer_service._compute_on_hand(
        db_session, company_id=company.id, printed_transfer_id=transfer.id
    )
    assert printed_on_hand == 12

    # ---- T4 idempotency: re-complete is a no-op (no double-credit) ----
    await print_order_service.complete_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=created.id,
        payload=PrintOrderComplete(),
    )
    refreshed_roll2 = (await db_session.exec(select(PaperRoll).where(PaperRoll.id == roll.id))).first()
    assert refreshed_roll2.current_meters == Decimal("95.80")
    paper_moves2 = list(
        (await db_session.exec(select(PaperRollMovement).where(PaperRollMovement.print_order_id == created.id))).all()
    )
    assert len(paper_moves2) == 1
    assert (
        await printed_transfer_service._compute_on_hand(
            db_session, company_id=company.id, printed_transfer_id=transfer.id
        )
        == 12
    )

    # ---- T5: assemble 10 of the 12 blanks + printed → finished SKU ----
    run = await assembly_service.assemble(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=AssembleBody(blank_piece_id=blank.id, printed_transfer_id=transfer.id, quantity=10),
    )
    assert run.created_new_variation is True
    assert run.sku == ProductVariation.make_sku(spec.code, Size.M, "PRT", design.code)
    assert run.quantity == 10

    # Blank on-hand 12 → 2; printed on-hand 12 → 2.
    assert await _blank_on_hand(db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color_code="PRT") == 2
    assert (
        await printed_transfer_service._compute_on_hand(
            db_session, company_id=company.id, printed_transfer_id=transfer.id
        )
        == 2
    )

    # Finished StockEntry credited +10 (source=assembly, provenance set).
    entry = (
        await db_session.exec(
            select(StockEntry).where(
                StockEntry.company_id == company.id,
                StockEntry.variation_id == run.variation.id,
            )
        )
    ).first()
    assert entry is not None
    assert entry.quantity == 10
    assert entry.source == StockSource.ASSEMBLY
    assert entry.assembly_run_id == run.id

    # The 3 ledger rows all carry the run id as provenance.
    blank_exit = (
        await db_session.exec(select(BlankPieceMovement).where(BlankPieceMovement.assembly_run_id == run.id))
    ).all()
    printed_exit = (
        await db_session.exec(select(PrintedTransferMovement).where(PrintedTransferMovement.assembly_run_id == run.id))
    ).all()
    assert len(list(blank_exit)) == 1
    assert len(list(printed_exit)) == 1

    # Finished stock on-hand for the resolved SKU == 10 (immediately order-ready).
    from services import stock as stock_service

    on_hand = await stock_service._compute_on_hand(db_session, company_id=company.id, variation_id=run.variation.id)
    assert on_hand == 10


async def test_assemble_guard_beyond_on_hand_no_partial_writes(db_session):
    """Assembling beyond min(blank, printed) → 409 with no partial writes."""

    company, user, spec, blank = await _seed_t3_end_state(db_session)  # 12 blanks

    design = await create_print_design(
        db_session, company_id=company.id, code="FLR03", name="Floral", technique=PrintTechnique.DTF
    )
    variation = await create_print_design_variation(db_session, company_id=company.id, print_design_id=design.id)
    roll = await create_paper_roll(db_session, company_id=company.id, paper_type=PaperType.DTF_FILM)

    # Only 5 printed transfers on hand (front).
    created = await print_order_service.create_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintOrderCreate(
            print_design_id=design.id,
            paper_roll_id=roll.id,
            planned_outputs=[
                PrintOrderOutputItem(print_design_variation_id=variation.id, side=PrintSide.FRONT, planned_quantity=5)
            ],
        ),
    )
    await print_order_service.update_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=created.id,
        payload=PrintOrderUpdate(
            printed_outputs=[
                PrintOrderOutputItem2(print_design_variation_id=variation.id, side=PrintSide.FRONT, printed_quantity=5)
            ],
        ),
    )
    await print_order_service.complete_print_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=created.id,
        payload=PrintOrderComplete(),
    )
    transfer = (
        await db_session.exec(
            select(PrintedTransfer).where(
                PrintedTransfer.company_id == company.id,
                PrintedTransfer.print_design_id == design.id,
                PrintedTransfer.side == PrintSide.FRONT,
            )
        )
    ).first()
    assert transfer is not None

    # Ask to assemble 12 (more than the 5 printed on hand) -> 409.
    raised = False
    try:
        await assembly_service.assemble(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=AssembleBody(blank_piece_id=blank.id, printed_transfer_id=transfer.id, quantity=12),
        )
    except ConflictError:
        raised = True
    assert raised

    # No partial writes: no AssemblyRun, no exits, no StockEntry; on-hand intact.
    runs = list((await db_session.exec(select(AssemblyRun).where(AssemblyRun.company_id == company.id))).all())
    asm_blank_exits = list(
        (await db_session.exec(select(BlankPieceMovement).where(BlankPieceMovement.assembly_run_id.isnot(None)))).all()
    )
    asm_entries = list(
        (await db_session.exec(select(StockEntry).where(StockEntry.source == StockSource.ASSEMBLY))).all()
    )
    assert runs == []
    assert asm_blank_exits == []
    assert asm_entries == []
    assert await _blank_on_hand(db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color_code="PRT") == 12
    assert (
        await printed_transfer_service._compute_on_hand(
            db_session, company_id=company.id, printed_transfer_id=transfer.id
        )
        == 5
    )
