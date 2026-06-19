"""Unit tests for the Planning (Planejamento) service — Phase 5.

The suggestion math is the contract here (a port of ``OrionDemand.build``):

- demand-only shortfall (no finished, no min) → corte + impressão = net demand;
- finished stock covering demand → net 0 → no suggestion;
- min-stock reorder (no demand) → stock-driven shortfall;
- WIP subtraction: open cutting / open sewing reduce the corte; open print
  reduces the impressão;
- buildable / state classification on the per-SKU breakdown;
- bulk-create produces PENDING cutting / print orders (no roll / paper), and
  skips stale / silkscreen / no-variation impressões;
- tenant isolation; unmapped + no-print items excluded.
"""

import uuid

from sqlmodel import select

from models import (
    ArtworkStatus,
    BlankMovementKind,
    CuttingOrder,
    CuttingStatus,
    OrderStatus,
    PrintOrder,
    PrintOrderStatus,
    PrintSide,
    PrintTechnique,
    SeparationStatus,
    ShipmentStatus,
    Size,
)
from services import company_settings as settings_service
from services import planning as service
from tests.factories import (
    create_ad,
    create_blank_piece,
    create_blank_piece_movement,
    create_client,
    create_company,
    create_cutting_order,
    create_cutting_order_output,
    create_fabric_roll,
    create_order,
    create_order_item,
    create_print_design,
    create_print_design_variation,
    create_print_order,
    create_print_order_output,
    create_printed_transfer,
    create_printed_transfer_movement,
    create_product,
    create_product_spec,
    create_product_variation,
    create_sewing_contractor,
    create_sewing_shipment,
    create_sewing_shipment_item,
    create_user,
)

# --------------------------------------------------------------------- fixtures


async def _company(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    return company, user


async def _demand(
    db_session,
    *,
    company_id,
    spec,
    design,
    size=Size.M,
    color="Preto",
    color_code="PRT",
    pieces=1,
    order_status=OrderStatus.PENDING,
    item_status=SeparationStatus.PENDING,
):
    """Create one order with ``pieces`` open OrderItems resolving to a SKU.

    Builds Product(spec, print) → variation, then an ad + order + N items. Returns
    the variation so finished stock can target it. The Product is find-or-created
    so multiple sizes of the same (spec, design) share one product (the
    ``(spec_id, print_id)`` unique constraint allows only one).
    """

    from models import Product

    product = (
        await db_session.exec(
            select(Product).where(
                Product.company_id == company_id, Product.spec_id == spec.id, Product.print_id == design.id
            )
        )
    ).first()
    if product is None:
        product = await create_product(
            db_session, company_id=company_id, spec_id=spec.id, print_id=design.id, name=f"{spec.code}-{design.code}"
        )
    variation = await create_product_variation(
        db_session,
        company_id=company_id,
        product_id=product.id,
        size=size,
        color=color,
        color_code=color_code,
        sku=f"{spec.code}-{size.value.upper()}-{color_code}-{design.code}",
    )
    client = await create_client(db_session, company_id=company_id)
    ad = await create_ad(db_session, company_id=company_id, product_id=product.id)
    order = await create_order(
        db_session,
        company_id=company_id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        quantity=pieces,
        status=order_status,
    )
    for index in range(pieces):
        await create_order_item(
            db_session,
            company_id=company_id,
            order_id=order.id,
            variation_id=variation.id,
            status=item_status,
            item_index=index,
            total_items=pieces,
        )
    return variation, order


async def _order_no_items(
    db_session,
    *,
    company_id,
    spec,
    design,  # PrintDesign | None — None builds a no-print (blank) product
    size=Size.M,
    color="Preto",
    color_code="PRT",
    quantity=1,
    order_status=OrderStatus.PENDING,
):
    """Create one open order of ``quantity`` units with **no** OrderItem rows.

    This mirrors production reality: live / Upseller / base44 orders don't
    materialize separation pieces until labels are printed, so Planning must read
    demand from ``Order.quantity``. ``design=None`` builds a no-print product
    (the order should then surface as cut-only).
    """

    from models import Product

    print_id = design.id if design is not None else None
    product = (
        await db_session.exec(
            select(Product).where(
                Product.company_id == company_id,
                Product.spec_id == spec.id,
                Product.print_id == print_id,
            )
        )
    ).first()
    if product is None:
        suffix = design.code if design is not None else "LISA"
        product = await create_product(
            db_session, company_id=company_id, spec_id=spec.id, print_id=print_id, name=f"{spec.code}-{suffix}"
        )
    sku = f"{spec.code}-{size.value.upper()}-{color_code}" + (f"-{design.code}" if design is not None else "")
    variation = await create_product_variation(
        db_session,
        company_id=company_id,
        product_id=product.id,
        size=size,
        color=color,
        color_code=color_code,
        sku=sku,
    )
    client = await create_client(db_session, company_id=company_id)
    ad = await create_ad(db_session, company_id=company_id, product_id=product.id)
    order = await create_order(
        db_session,
        company_id=company_id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        quantity=quantity,
        status=order_status,
    )
    return variation, order


def _corte(suggestions, *, spec_id, color_code):
    return next((c for c in suggestions.cortes if c.key == f"{spec_id}|{color_code}"), None)


def _impressao(suggestions, *, design_id):
    return next((i for i in suggestions.impressoes if i.key == str(design_id)), None)


def _sku(suggestions, *, design_id, spec_id, color_code, size):
    key = f"{design_id}|{spec_id}|{color_code}|{size.value}"
    return next((s for s in suggestions.skus if s.key == key), None)


# ----------------------------------------------------------- demand-only engine


async def test_demand_only_shortfall(db_session):
    """No finished, no blank/printed, no min → corte + impressão = net demand."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01", name="Camiseta")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03", name="Floral")
    await _demand(db_session, company_id=company.id, spec=spec, design=design, size=Size.M, color_code="PRT", pieces=5)

    s = await service.build_suggestions(db_session, company_id=company.id)

    sku = _sku(s, design_id=design.id, spec_id=spec.id, color_code="PRT", size=Size.M)
    assert sku is not None
    assert sku.needed == 5 and sku.finished == 0 and sku.net == 5
    assert sku.blank_have == 0 and sku.printed_have == 0
    assert sku.blank_short == 5 and sku.printed_short == 5
    assert sku.buildable == 0 and sku.state == "ambos"
    assert sku.order_count == 1

    corte = _corte(s, spec_id=spec.id, color_code="PRT")
    assert corte is not None
    assert corte.total == 5 and corte.demand == 5 and corte.stock == 0
    assert corte.sources == ["demanda"]
    assert corte.order_count == 1
    assert [(g.size, g.qty, g.demand_qty, g.stock_qty) for g in corte.grade_rows] == [(Size.M, 5, 5, 0)]

    impressao = _impressao(s, design_id=design.id)
    assert impressao is not None
    assert impressao.total == 5 and impressao.demand == 5 and impressao.stock == 0
    assert impressao.sources == ["demanda"]

    assert s.totals.toCut == 5 and s.totals.toPrint == 5
    assert s.totals.cortes == 1 and s.totals.impressoes == 1
    assert s.totals.demandDriven == 2 and s.totals.stockDriven == 0


async def test_finished_stock_covers_demand_net_zero(db_session):
    """Finished stock >= needed → net 0 → no corte / impressão for that SKU."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    variation, _order = await _demand(
        db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=4
    )
    # Credit 4 finished pieces of the exact ordered variation.
    from models import StockEntry, StockSource

    db_session.add(
        StockEntry(company_id=company.id, variation_id=variation.id, quantity=4, source=StockSource.ADJUSTMENT)
    )
    await db_session.commit()

    s = await service.build_suggestions(db_session, company_id=company.id)
    sku = _sku(s, design_id=design.id, spec_id=spec.id, color_code="PRT", size=Size.M)
    assert sku is not None and sku.finished == 4 and sku.net == 0 and sku.state == "pronto"
    assert _corte(s, spec_id=spec.id, color_code="PRT") is None
    assert _impressao(s, design_id=design.id) is None
    assert s.totals.toCut == 0 and s.totals.toPrint == 0


async def test_partial_finished_reduces_net(db_session):
    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    variation, _order = await _demand(
        db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=10
    )
    from models import StockEntry, StockSource

    db_session.add(
        StockEntry(company_id=company.id, variation_id=variation.id, quantity=3, source=StockSource.ADJUSTMENT)
    )
    await db_session.commit()

    s = await service.build_suggestions(db_session, company_id=company.id)
    sku = _sku(s, design_id=design.id, spec_id=spec.id, color_code="PRT", size=Size.M)
    assert sku.finished == 3 and sku.net == 7
    assert _corte(s, spec_id=spec.id, color_code="PRT").total == 7
    assert _impressao(s, design_id=design.id).total == 7


# ------------------------------------------- demand is order-driven (not items)


async def test_demand_from_open_order_without_items(db_session):
    """Regression: an open order with NO OrderItem rows still drives full demand.

    The production bug — orders are imported without separation pieces (those are
    materialized lazily at label printing), so demand must come from
    ``Order.quantity``. Counting ``order_items`` made Planning show "nothing to
    do" while real orders waited.
    """

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _order_no_items(
        db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", quantity=5
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    sku = _sku(s, design_id=design.id, spec_id=spec.id, color_code="PRT", size=Size.M)
    assert sku is not None and sku.needed == 5 and sku.net == 5 and sku.order_count == 1
    assert _corte(s, spec_id=spec.id, color_code="PRT").total == 5
    assert _impressao(s, design_id=design.id).total == 5
    assert s.totals.toCut == 5 and s.totals.toPrint == 5


async def test_demand_is_quantity_weighted(db_session):
    """One order of quantity N counts as N pieces (not one row)."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _order_no_items(
        db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", quantity=12
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    assert _corte(s, spec_id=spec.id, color_code="PRT").total == 12


async def test_no_print_order_is_cut_only(db_session):
    """An open order whose product has no print → cut demand, no SKU / impressão.

    A blank garment is cut, never printed. The design is a LEFT JOIN, so the
    demand stays visible as a corte instead of being silently dropped.
    """

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    await _order_no_items(
        db_session, company_id=company.id, spec=spec, design=None, size=Size.G, color_code="ARE", quantity=4
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    corte = _corte(s, spec_id=spec.id, color_code="ARE")
    assert corte is not None and corte.total == 4 and corte.demand == 4 and corte.stock == 0
    assert [(g.size, g.qty) for g in corte.grade_rows] == [(Size.G, 4)]
    # No design resolved → absent from the per-SKU breakdown and the impressões.
    assert s.skus == []
    assert s.impressoes == []
    assert s.totals.toCut == 4 and s.totals.toPrint == 0


async def test_partial_checked_reduces_order_demand(db_session):
    """Already-separated (CHECKED) pieces are subtracted from quantity demand."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    variation, order = await _order_no_items(
        db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", quantity=5
    )
    # 2 of the 5 pieces already separated → demand 3 (the rest aren't materialized).
    for index in range(2):
        await create_order_item(
            db_session,
            company_id=company.id,
            order_id=order.id,
            variation_id=variation.id,
            status=SeparationStatus.CHECKED,
            item_index=index,
            total_items=5,
        )

    s = await service.build_suggestions(db_session, company_id=company.id)
    sku = _sku(s, design_id=design.id, spec_id=spec.id, color_code="PRT", size=Size.M)
    assert sku.needed == 3
    assert _corte(s, spec_id=spec.id, color_code="PRT").total == 3
    assert _impressao(s, design_id=design.id).total == 3


# -------------------------------------------------- component on-hand reduces


async def test_blank_and_printed_on_hand_reduce_shortfall_and_buildable(db_session):
    """Blank/printed on-hand reduce the per-tier shortfall and set buildable/state."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _demand(db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=10)

    # 6 blank on-hand for (spec, PRT, M); 8 printed on-hand for design FRONT.
    # min_stock=0 isolates the demand engine from the min-stock reorder engine.
    blank = await create_blank_piece(
        db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto", color_code="PRT", min_stock=0
    )
    await create_blank_piece_movement(
        db_session, company_id=company.id, blank_piece_id=blank.id, kind=BlankMovementKind.ENTRY, quantity=6
    )
    transfer = await create_printed_transfer(
        db_session, company_id=company.id, print_design_id=design.id, side=PrintSide.FRONT, min_stock=0
    )
    await create_printed_transfer_movement(
        db_session, company_id=company.id, printed_transfer_id=transfer.id, quantity=8
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    sku = _sku(s, design_id=design.id, spec_id=spec.id, color_code="PRT", size=Size.M)
    assert sku.net == 10
    assert sku.blank_have == 6 and sku.printed_have == 8
    assert sku.blank_short == 4 and sku.printed_short == 2
    assert sku.buildable == 6  # min(10, 6, 8)
    assert sku.state == "ambos"  # both still short

    # Corte: demand 10 - count 6 - wip 0 = 4. Impressão: 10 - 8 = 2.
    assert _corte(s, spec_id=spec.id, color_code="PRT").total == 4
    assert _impressao(s, design_id=design.id).total == 2


async def test_state_pronto_when_both_covered(db_session):
    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _demand(db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=3)

    # min_stock=0 on both tiers isolates the per-SKU state from the reorder engine.
    blank = await create_blank_piece(
        db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto", color_code="PRT", min_stock=0
    )
    await create_blank_piece_movement(
        db_session, company_id=company.id, blank_piece_id=blank.id, kind=BlankMovementKind.ENTRY, quantity=5
    )
    transfer = await create_printed_transfer(
        db_session, company_id=company.id, print_design_id=design.id, side=PrintSide.FRONT, min_stock=0
    )
    await create_printed_transfer_movement(
        db_session, company_id=company.id, printed_transfer_id=transfer.id, quantity=5
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    sku = _sku(s, design_id=design.id, spec_id=spec.id, color_code="PRT", size=Size.M)
    assert sku.blank_short == 0 and sku.printed_short == 0
    assert sku.buildable == 3 and sku.state == "pronto"
    # Both components cover demand and min_stock=0 → no suggestions.
    assert _corte(s, spec_id=spec.id, color_code="PRT") is None
    assert _impressao(s, design_id=design.id) is None


# ------------------------------------------------------- min-stock reorder only


async def test_min_stock_reorder_only_no_demand(db_session):
    """A blank tier below its row min (no demand) yields a stock-driven corte."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    # No demand at all. Blank with min_stock=20, on-hand=5 → reorder 15.
    blank = await create_blank_piece(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        size=Size.G,
        color="Areia",
        color_code="ARE",
        min_stock=20,
    )
    await create_blank_piece_movement(
        db_session, company_id=company.id, blank_piece_id=blank.id, kind=BlankMovementKind.ENTRY, quantity=5
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    corte = _corte(s, spec_id=spec.id, color_code="ARE")
    assert corte is not None
    assert corte.total == 15 and corte.demand == 0 and corte.stock == 15
    assert corte.sources == ["estoque"]
    assert corte.order_count == 0
    assert [(g.size, g.qty, g.demand_qty, g.stock_qty) for g in corte.grade_rows] == [(Size.G, 15, 0, 15)]
    assert s.totals.stockDriven == 1 and s.totals.demandDriven == 0


async def test_company_threshold_used_when_no_row_min(db_session):
    """When a blank row has no min_stock, the company ``stockThresholds['blank']`` value applies."""

    company, _user = await _company(db_session)
    # Default config: blank threshold enabled, value 20.
    settings = await settings_service.get_settings(db_session, company_id=company.id)
    assert settings.config["stockThresholds"]["blank"]["value"] == 20

    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    blank = await create_blank_piece(
        db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto", color_code="PRT", min_stock=None
    )
    await create_blank_piece_movement(
        db_session, company_id=company.id, blank_piece_id=blank.id, kind=BlankMovementKind.ENTRY, quantity=8
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    corte = _corte(s, spec_id=spec.id, color_code="PRT")
    assert corte is not None and corte.stock == 12  # 20 - 8


async def test_printed_row_min_stock_drives_stock_only_impressao(db_session):
    """A FRONT printed transfer below its row ``min_stock`` (no demand) → stock-driven impressão."""

    company, _user = await _company(db_session)
    design = await create_print_design(db_session, company_id=company.id, code="FLR03", name="Floral")
    # FRONT transfer with on-hand 4 and a row min of 15 → reorder 11.
    transfer = await create_printed_transfer(
        db_session, company_id=company.id, print_design_id=design.id, side=PrintSide.FRONT, min_stock=15
    )
    await create_printed_transfer_movement(
        db_session, company_id=company.id, printed_transfer_id=transfer.id, quantity=4
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    impressao = _impressao(s, design_id=design.id)
    assert impressao is not None
    assert impressao.total == 11 and impressao.demand == 0 and impressao.stock == 11
    assert impressao.sources == ["estoque"]
    assert impressao.order_count == 0
    # No cortes (no blank catalog, no demand).
    assert s.cortes == []


async def test_printed_company_threshold_seeds_impressao(db_session):
    """A FRONT transfer with no row min uses the company ``stockThresholds['printed']`` value (10)."""

    company, _user = await _company(db_session)
    settings = await settings_service.get_settings(db_session, company_id=company.id)
    assert settings.config["stockThresholds"]["printed"]["value"] == 10

    design = await create_print_design(db_session, company_id=company.id, code="GEO01")
    transfer = await create_printed_transfer(
        db_session, company_id=company.id, print_design_id=design.id, side=PrintSide.FRONT, min_stock=None
    )
    await create_printed_transfer_movement(
        db_session, company_id=company.id, printed_transfer_id=transfer.id, quantity=3
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    impressao = _impressao(s, design_id=design.id)
    assert impressao is not None and impressao.stock == 7  # 10 - 3


async def test_threshold_disabled_means_no_reorder(db_session):
    company, user = await _company(db_session)
    config = settings_service.default_config()
    config["stockThresholds"]["blank"] = {"enabled": False, "unit": "qty", "value": 20}
    await settings_service.update_settings(db_session, company_id=company.id, user_id=user.id, config=config)

    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    blank = await create_blank_piece(
        db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto", color_code="PRT", min_stock=None
    )
    await create_blank_piece_movement(
        db_session, company_id=company.id, blank_piece_id=blank.id, kind=BlankMovementKind.ENTRY, quantity=1
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    assert _corte(s, spec_id=spec.id, color_code="PRT") is None


async def test_demand_plus_stock_combined(db_session):
    """A tier with both unmet demand AND a min reorder reports both sources."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _demand(db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=8)

    # Blank on-hand 5, min 20. demand=8.
    blank = await create_blank_piece(
        db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto", color_code="PRT", min_stock=20
    )
    await create_blank_piece_movement(
        db_session, company_id=company.id, blank_piece_id=blank.id, kind=BlankMovementKind.ENTRY, quantity=5
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    corte = _corte(s, spec_id=spec.id, color_code="PRT")
    # demandShort = max(0, 8 - 5 - 0) = 3. afterDemand = max(0, 5 - 8) = 0.
    # stockShort = max(0, 20 - 0) = 20. total = 23.
    assert corte.demand == 3 and corte.stock == 20 and corte.total == 23
    assert set(corte.sources) == {"demanda", "estoque"}


# ----------------------------------------------------------------- WIP subtraction


async def test_open_cutting_wip_reduces_corte(db_session):
    """An open (non-DONE) cutting order's planned output is blank in-production."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _demand(db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=10)

    roll = await create_fabric_roll(db_session, company_id=company.id)
    co = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=roll.id,
        color="Preto",
        color_code="PRT",
        status=CuttingStatus.CUTTING,
    )
    await create_cutting_order_output(db_session, cutting_order_id=co.id, size=Size.M, quantity=4)

    s = await service.build_suggestions(db_session, company_id=company.id)
    # demand 10 - count 0 - wip 4 = 6.
    assert _corte(s, spec_id=spec.id, color_code="PRT").total == 6


async def test_done_cutting_wip_not_counted(db_session):
    """A DONE cutting order is NOT in-production (its outputs are real cut pieces)."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _demand(db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=10)

    roll = await create_fabric_roll(db_session, company_id=company.id)
    co = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=roll.id,
        color="Preto",
        color_code="PRT",
        status=CuttingStatus.DONE,
    )
    await create_cutting_order_output(db_session, cutting_order_id=co.id, size=Size.M, quantity=4)

    s = await service.build_suggestions(db_session, company_id=company.id)
    assert _corte(s, spec_id=spec.id, color_code="PRT").total == 10  # no WIP subtracted


async def test_open_sewing_wip_reduces_corte(db_session):
    """Open sewing (requested - received) on a SENT shipment is blank in-production."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _demand(db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=10)

    roll = await create_fabric_roll(db_session, company_id=company.id)
    co = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=roll.id,
        color="Preto",
        color_code="PRT",
        status=CuttingStatus.DONE,
    )
    await create_cutting_order_output(db_session, cutting_order_id=co.id, size=Size.M, quantity=20)
    contractor = await create_sewing_contractor(db_session, company_id=company.id)
    shipment = await create_sewing_shipment(
        db_session,
        company_id=company.id,
        cutting_order_id=co.id,
        contractor_id=contractor.id,
        status=ShipmentStatus.SENT,
    )
    await create_sewing_shipment_item(
        db_session,
        shipment_id=shipment.id,
        size=Size.M,
        requested_quantity=7,
        received_quantity=2,
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    # open_sewing = max(0, 7 - 2) = 5. demand 10 - 0 - 5 = 5.
    assert _corte(s, spec_id=spec.id, color_code="PRT").total == 5


async def test_open_print_wip_reduces_impressao(db_session):
    """An open (non-DONE) print order's (planned - printed) is printed in-production."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _demand(db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=10)

    variation = await create_print_design_variation(db_session, company_id=company.id, print_design_id=design.id)
    po = await create_print_order(
        db_session, company_id=company.id, print_design_id=design.id, status=PrintOrderStatus.PRINTING
    )
    await create_print_order_output(
        db_session,
        print_order_id=po.id,
        print_design_variation_id=variation.id,
        side=PrintSide.FRONT,
        planned_quantity=6,
        printed_quantity=2,
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    # printed wip = max(0, 6 - 2) = 4. demand 10 - 0 - 4 = 6.
    assert _impressao(s, design_id=design.id).total == 6


# ------------------------------------------------------ exclusions + grouping


async def test_unmapped_items_ignored_and_no_print_is_cut_only(db_session):
    """Demand is order-driven: a stray unmapped item never changes it, and a
    no-print order surfaces as cut-only (a corte, but no design SKU / impressão)."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    _variation, order = await _demand(
        db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=2
    )
    # A stray, unmapped order_item (variation_id NULL) must not change demand.
    await create_order_item(db_session, company_id=company.id, order_id=order.id, variation_id=None)

    # A separate order whose product has NO print (print_id None).
    await _order_no_items(
        db_session, company_id=company.id, spec=spec, design=None, size=Size.G, color_code="ARE", quantity=3
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    # Printed SKU keeps its order-driven demand of 2, unaffected by the stray item.
    sku = _sku(s, design_id=design.id, spec_id=spec.id, color_code="PRT", size=Size.M)
    assert sku.needed == 2
    assert _corte(s, spec_id=spec.id, color_code="PRT").total == 2
    # No-print order → a cut corte, but resolves no design SKU and no impressão.
    assert _corte(s, spec_id=spec.id, color_code="ARE").total == 3
    assert _sku(s, design_id=design.id, spec_id=spec.id, color_code="ARE", size=Size.G) is None
    assert len(s.impressoes) == 1 and s.impressoes[0].design.id == design.id


async def test_checked_items_and_shipped_orders_excluded(db_session):
    """CHECKED items and shipped/cancelled orders are not open demand."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")

    # CHECKED item in a PENDING order → excluded.
    await _demand(
        db_session,
        company_id=company.id,
        spec=spec,
        design=design,
        color_code="PRT",
        pieces=3,
        item_status=SeparationStatus.CHECKED,
    )
    # PENDING items but a SHIPPED order → excluded.
    await _demand(
        db_session,
        company_id=company.id,
        spec=spec,
        design=design,
        size=Size.G,
        color_code="ARE",
        pieces=4,
        order_status=OrderStatus.SHIPPED,
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    assert s.cortes == []
    assert s.impressoes == []
    assert s.totals.toCut == 0


async def test_paid_orders_and_label_printed_items_are_open(db_session):
    """PAID orders + LABEL_PRINTED items still count as open demand."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _demand(
        db_session,
        company_id=company.id,
        spec=spec,
        design=design,
        color_code="PRT",
        pieces=3,
        order_status=OrderStatus.PAID,
        item_status=SeparationStatus.LABEL_PRINTED,
    )
    s = await service.build_suggestions(db_session, company_id=company.id)
    assert _corte(s, spec_id=spec.id, color_code="PRT").total == 3


async def test_cortes_group_by_spec_color_with_per_size_grade(db_session):
    """Two sizes of the same (spec, color) collapse into one corte with a 2-row grade."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    # Same spec+color, two sizes (M=2, G=3). The grade should be size-ordered.
    await _demand(db_session, company_id=company.id, spec=spec, design=design, size=Size.G, color_code="PRT", pieces=3)
    await _demand(db_session, company_id=company.id, spec=spec, design=design, size=Size.M, color_code="PRT", pieces=2)

    s = await service.build_suggestions(db_session, company_id=company.id)
    corte = _corte(s, spec_id=spec.id, color_code="PRT")
    assert corte.total == 5
    assert [(g.size, g.qty) for g in corte.grade_rows] == [(Size.M, 2), (Size.G, 3)]  # P,M,G order
    # The design demand folds across both sizes into one impressão of 5.
    assert _impressao(s, design_id=design.id).total == 5


async def test_silkscreen_excluded_from_impressoes_but_in_cortes(db_session):
    """A silkscreen design contributes to cortes but never to impressões."""

    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(
        db_session, company_id=company.id, code="SLK01", technique=PrintTechnique.SILKSCREEN
    )
    await _demand(db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=6)

    s = await service.build_suggestions(db_session, company_id=company.id)
    assert _corte(s, spec_id=spec.id, color_code="PRT").total == 6
    assert _impressao(s, design_id=design.id) is None
    assert s.totals.toPrint == 0


async def test_png_flag_reflects_front_variation_status(db_session):
    company, _user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design_ok = await create_print_design(db_session, company_id=company.id, code="OK01")
    design_pending = await create_print_design(db_session, company_id=company.id, code="PD01")
    await _demand(db_session, company_id=company.id, spec=spec, design=design_ok, color_code="PRT", pieces=2)
    await _demand(
        db_session, company_id=company.id, spec=spec, design=design_pending, size=Size.G, color_code="ARE", pieces=2
    )
    await create_print_design_variation(
        db_session,
        company_id=company.id,
        print_design_id=design_ok.id,
        front_status=ArtworkStatus.OK,
        front_file_url="https://x/ok.png",
    )
    await create_print_design_variation(
        db_session, company_id=company.id, print_design_id=design_pending.id, front_status=ArtworkStatus.PENDING
    )

    s = await service.build_suggestions(db_session, company_id=company.id)
    assert _impressao(s, design_id=design_ok.id).png == "ok"
    assert _impressao(s, design_id=design_pending.id).png == "pending"


async def test_tenant_isolation(db_session):
    company_a, _ua = await _company(db_session)
    company_b, _ub = await _company(db_session)
    spec_a = await create_product_spec(db_session, company_id=company_a.id, code="CAM01")
    design_a = await create_print_design(db_session, company_id=company_a.id, code="FLR03")
    await _demand(db_session, company_id=company_a.id, spec=spec_a, design=design_a, color_code="PRT", pieces=5)
    spec_b = await create_product_spec(db_session, company_id=company_b.id, code="CAM09")
    design_b = await create_print_design(db_session, company_id=company_b.id, code="GEO01")
    await _demand(db_session, company_id=company_b.id, spec=spec_b, design=design_b, color_code="BLU", pieces=9)

    s_a = await service.build_suggestions(db_session, company_id=company_a.id)
    assert s_a.totals.toCut == 5
    assert len(s_a.cortes) == 1 and s_a.cortes[0].key == f"{spec_a.id}|PRT"


# --------------------------------------------------------------- bulk-create


async def test_create_cutting_orders_creates_pending_no_roll(db_session):
    company, user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _demand(db_session, company_id=company.id, spec=spec, design=design, size=Size.M, color_code="PRT", pieces=4)
    await _demand(db_session, company_id=company.id, spec=spec, design=design, size=Size.G, color_code="PRT", pieces=2)

    key = f"{spec.id}|PRT"
    result = await service.create_cutting_orders(db_session, company_id=company.id, user_id=user.id, keys=[key])
    assert result.created_count == 1
    created = result.created[0]
    assert created.key == key and created.total == 6
    assert result.skipped == []

    # The order is PENDING with no roll and the suggestion grade.
    order = (await db_session.exec(select(CuttingOrder).where(CuttingOrder.id == created.cutting_order_id))).first()
    assert order is not None
    assert order.status == CuttingStatus.PENDING
    assert order.body_roll_id is None and order.rib_roll_id is None
    assert order.spec_id == spec.id and order.color_code == "PRT"

    from models import CuttingOrderOutput

    outputs = list(
        (await db_session.exec(select(CuttingOrderOutput).where(CuttingOrderOutput.cutting_order_id == order.id))).all()
    )
    by_size = {o.size: o.quantity for o in outputs}
    assert by_size == {Size.M: 4, Size.G: 2}


async def test_create_cutting_orders_skips_stale_key(db_session):
    company, user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _demand(db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=4)

    bogus = f"{uuid.uuid4()}|XYZ"
    result = await service.create_cutting_orders(
        db_session, company_id=company.id, user_id=user.id, keys=[f"{spec.id}|PRT", bogus]
    )
    assert result.created_count == 1
    assert result.skipped == [type(result.skipped[0])(key=bogus, reason="stale")]


async def test_create_print_orders_creates_pending_front_output(db_session):
    company, user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _demand(db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=7)
    variation = await create_print_design_variation(
        db_session,
        company_id=company.id,
        print_design_id=design.id,
        front_status=ArtworkStatus.OK,
        front_file_url="https://x/ok.png",
    )

    result = await service.create_print_orders(
        db_session, company_id=company.id, user_id=user.id, keys=[str(design.id)]
    )
    assert result.created_count == 1
    created = result.created[0]
    assert created.total == 7 and created.code.startswith("IM-")

    order = (await db_session.exec(select(PrintOrder).where(PrintOrder.id == created.print_order_id))).first()
    assert order.status == PrintOrderStatus.PENDING and order.paper_roll_id is None

    from models import PrintOrderOutput

    outputs = list(
        (await db_session.exec(select(PrintOrderOutput).where(PrintOrderOutput.print_order_id == order.id))).all()
    )
    assert len(outputs) == 1
    assert outputs[0].side == PrintSide.FRONT
    assert outputs[0].print_design_variation_id == variation.id
    assert outputs[0].planned_quantity == 7


async def test_create_print_orders_skips_no_variation(db_session):
    """A demand design with NO variation is reported as ``no_variation`` (not crash)."""

    company, user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _demand(db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=5)

    result = await service.create_print_orders(
        db_session, company_id=company.id, user_id=user.id, keys=[str(design.id)]
    )
    assert result.created_count == 0
    assert result.skipped[0].reason == "no_variation"
    # No print order created.
    assert list((await db_session.exec(select(PrintOrder))).all()) == []


async def test_create_print_orders_picks_front_ready_variation(db_session):
    """When several variations exist, the first FRONT-ready one is chosen."""

    company, user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03")
    await _demand(db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=3)
    # Pending one created first, ready one second → ready must win.
    await create_print_design_variation(
        db_session, company_id=company.id, print_design_id=design.id, name="Pending", front_status=ArtworkStatus.PENDING
    )
    ready = await create_print_design_variation(
        db_session,
        company_id=company.id,
        print_design_id=design.id,
        name="Ready",
        front_status=ArtworkStatus.OK,
        front_file_url="https://x/ok.png",
    )

    result = await service.create_print_orders(
        db_session, company_id=company.id, user_id=user.id, keys=[str(design.id)]
    )
    assert result.created_count == 1
    from models import PrintOrderOutput

    output = (
        await db_session.exec(
            select(PrintOrderOutput).where(PrintOrderOutput.print_order_id == result.created[0].print_order_id)
        )
    ).first()
    assert output.print_design_variation_id == ready.id


async def test_create_print_orders_skips_back_only_design(db_session):
    """A back-only design (no front side) is reported as ``no_front_side`` on create.

    The impressão engine keys on FRONT as the reference, so a back-only design
    still surfaces a suggestion (it has a print); the FRONT print-order output
    then trips ``_validate_outputs`` → we report ``no_front_side``, no crash.
    """

    company, user = await _company(db_session)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01")
    design = await create_print_design(db_session, company_id=company.id, code="BCK01", has_front=False, has_back=True)
    await _demand(db_session, company_id=company.id, spec=spec, design=design, color_code="PRT", pieces=4)
    await create_print_design_variation(
        db_session,
        company_id=company.id,
        print_design_id=design.id,
        back_status=ArtworkStatus.OK,
        back_file_url="https://x/back.png",
    )

    result = await service.create_print_orders(
        db_session, company_id=company.id, user_id=user.id, keys=[str(design.id)]
    )
    assert result.created_count == 0
    assert result.skipped[0].reason == "no_front_side"
    assert list((await db_session.exec(select(PrintOrder))).all()) == []


async def test_create_print_orders_skips_stale(db_session):
    company, user = await _company(db_session)
    result = await service.create_print_orders(
        db_session, company_id=company.id, user_id=user.id, keys=[str(uuid.uuid4())]
    )
    assert result.created_count == 0
    assert result.skipped[0].reason == "stale"
