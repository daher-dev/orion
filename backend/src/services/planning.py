"""Service layer for the Planning (Planejamento) feature — Phase 5.

A **pure computed** demand→production engine, a port of the prototype's
``window.OrionDemand.build`` (``docs/design/pages/planejamento.jsx``) onto the
EXISTING fulfillment domain. There are NO new tables: demand comes from open
``orders`` + ``order_items``; component availability + WIP come exclusively from
the Phase 1-4 readers (``blank_stock``, ``printed_transfer``, ``stock`` ledgers).

Vocabulary bridge (prototype → real model)
------------------------------------------
- **open demand** = open ``orders`` (``Order.status in {PENDING, PAID}``),
  weighted by ``Order.quantity``, minus pieces already separated
  (``OrderItem.status == CHECKED``). Demand is the orders themselves — NOT the
  ``order_items`` separation pieces, which are materialized lazily (only when
  labels are printed; see ``services.order_item.generate_labels``) and so don't
  exist for orders that haven't reached separation — i.e. exactly the orders
  Planning exists to plan for. Counting ``order_items`` made Planning blind to
  every un-separated order.
- a product with **no print** (``Product.print_id IS NULL``) still produces cut
  demand (a blank garment is cut, just not printed): the design is a LEFT JOIN,
  so such rows carry ``design_id = None`` and are folded into *cortes* only —
  they resolve no (design, spec, color, size) SKU, so they're absent from the
  per-SKU breakdown and the *impressões*.
- demand SKU key = ``(print_design_id, spec_id, color_code, size)``.
- blank tier = ``(spec_id, color_code, size)`` (``BlankPiece``).
- impresso tier = ``(print_design_id, side=FRONT)`` (``PrintedTransfer``).
- finished = on-hand of the exact ordered ``ProductVariation``.

The accent of the algorithm is the **dual engine**: every tier produces
``demandShort + stockShort`` where ``afterDemand = max(0, count + wip - demand)``
and ``stockShort = max(0, min - afterDemand)``. ``min`` is the row's
``min_stock`` if set, else the company ``stockThresholds`` value (when enabled).

The two create functions recompute ``build_suggestions`` server-side (so a stale
client snapshot can't persist the wrong grade), index by ``key``, and delegate
to ``cutting.create_cutting_order`` / ``print_order.create_print_order`` — each
creating a **PENDING** order with no roll / paper. Partial success is allowed.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import case, func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    ArtworkStatus,
    BlankPiece,
    Order,
    OrderItem,
    OrderStatus,
    PrintDesign,
    PrintDesignVariation,
    PrintedTransfer,
    PrintOrder,
    PrintOrderOutput,
    PrintOrderStatus,
    PrintSide,
    PrintTechnique,
    Product,
    ProductSpec,
    ProductType,
    ProductVariation,
    SeparationStatus,
    Size,
    StockEntry,
    StockExit,
)
from schemas.cutting import CuttingCreate, OutputItem
from schemas.planning import (
    PlanningCorte,
    PlanningCorteGradeRow,
    PlanningCutCreated,
    PlanningCutResult,
    PlanningImpressao,
    PlanningPrintCreated,
    PlanningPrintResult,
    PlanningPrintSkipped,
    PlanningSkipped,
    PlanningSku,
    PlanningSpecRef,
    PlanningState,
    PlanningSuggestions,
    PlanningTotals,
    SuggestionSource,
)
from schemas.print_order import PrintDesignRef, PrintOrderCreate, PrintOrderOutputItem
from services import blank_stock as blank_stock_service
from services import company_settings as settings_service
from services import cutting as cutting_service
from services import print_order as print_order_service
from services import printed_transfer as printed_transfer_service
from shared.exceptions import ValidationError

# Stable size ordering for the cutting grade — the ``Size`` declaration order
# (P, M, G, GG, U), mirroring the prototype's ``sizeOrder``.
_SIZE_ORDER: dict[Size, int] = {size: index for index, size in enumerate(Size)}


# ---------------------------------------------------------------------- helpers


def _threshold_value(config: dict, key: str) -> int:
    """Resolve a company min-stock threshold (the reorder target) for a tier.

    Mirrors the ``blank_stock._is_low_stock`` precedence used as a *value*: the
    config threshold is the reorder target only when enabled and a value is set,
    else 0 (no reorder). Row-level ``min_stock`` overrides this at the call site.
    """

    threshold = (config.get("stockThresholds") or {}).get(key)
    if threshold and threshold.get("enabled") and threshold.get("value") is not None:
        return int(threshold["value"])
    return 0


# ------------------------------------------------------------ open-demand rows


async def _checked_pieces_by_variation(db: AsyncSession, *, company_id: uuid.UUID) -> dict[uuid.UUID, int]:
    """``{variation_id: checked_count}`` — pieces of open orders already separated.

    A piece is "separated" once its ``OrderItem`` is ``CHECKED`` (scan-to-check).
    Those pieces are picked and shouldn't be re-produced, so they're subtracted
    from the order-quantity demand. Keyed by the parent ``Order.variation_id``
    (the SKU the order resolves to), scoped to open parent orders.
    """

    stmt = (
        select(Order.variation_id, func.count(OrderItem.id))
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            Order.company_id == company_id,
            OrderItem.company_id == company_id,  # tenant-scope the ledger side too (own column, FK-unenforced)
            OrderItem.status == SeparationStatus.CHECKED,
            Order.status.in_((OrderStatus.PENDING, OrderStatus.PAID)),  # type: ignore[union-attr]
        )
        .group_by(Order.variation_id)
    )
    return {variation_id: int(total or 0) for variation_id, total in (await db.exec(stmt)).all()}


async def _open_demand_rows(db: AsyncSession, *, company_id: uuid.UUID) -> list[dict]:
    """Open-order demand, grouped by ``(print_design_id, spec_id, color_code, size)``.

    One row per demand SKU with ``needed`` (``Σ Order.quantity`` over open orders
    for the SKU, minus already-separated ``CHECKED`` pieces), the distinct
    ``order_ids`` set, the resolving ``variation_id`` (the key ⇄ variation is
    1:1), and carried display fields. Rows that net to zero (fully separated) are
    dropped.

    Demand is the open ``orders`` (``Order.status in {PENDING, PAID}``), each
    carrying ``quantity`` units of one ``ProductVariation`` — NOT the lazily
    materialized ``order_items``. The print design is a **LEFT JOIN** on
    ``Product.print_id``: a product with no print still produces cut demand and
    carries ``design_id = None``.
    """

    checked_by_variation = await _checked_pieces_by_variation(db, company_id=company_id)

    stmt = (
        select(
            PrintDesign.id,
            ProductSpec.id,
            ProductVariation.color_code,
            ProductVariation.size,
            ProductVariation.id,
            ProductVariation.color,
            ProductSpec.code,
            ProductSpec.name,
            PrintDesign.code,
            PrintDesign.name,
            PrintDesign.technique,
            PrintDesign.image_url,
            func.coalesce(func.sum(Order.quantity), 0).label("needed"),
            func.array_agg(func.distinct(Order.id)).label("order_ids"),
        )
        .select_from(Order)
        .join(ProductVariation, ProductVariation.id == Order.variation_id)
        .join(Product, Product.id == ProductVariation.product_id)
        .join(ProductSpec, ProductSpec.id == Product.spec_id)
        .outerjoin(PrintDesign, PrintDesign.id == Product.print_id)
        .where(
            Order.company_id == company_id,
            Order.status.in_((OrderStatus.PENDING, OrderStatus.PAID)),  # type: ignore[union-attr]
        )
        .group_by(
            PrintDesign.id,
            ProductSpec.id,
            ProductVariation.color_code,
            ProductVariation.size,
            ProductVariation.id,
            ProductVariation.color,
            ProductSpec.code,
            ProductSpec.name,
            PrintDesign.code,
            PrintDesign.name,
            PrintDesign.technique,
            PrintDesign.image_url,
        )
    )

    rows: list[dict] = []
    for record in (await db.exec(stmt)).all():
        (
            design_id,
            spec_id,
            color_code,
            size,
            variation_id,
            color,
            spec_code,
            spec_name,
            design_code,
            design_name,
            design_technique,
            design_image_url,
            needed,
            order_ids,
        ) = record
        net_needed = max(0, int(needed or 0) - checked_by_variation.get(variation_id, 0))
        if net_needed <= 0:
            continue
        rows.append(
            {
                "design_id": design_id,
                "spec_id": spec_id,
                "color_code": color_code,
                "size": size,
                "variation_id": variation_id,
                "color": color,
                "spec_code": spec_code,
                "spec_name": spec_name,
                "design_code": design_code,
                "design_name": design_name,
                "design_technique": design_technique,
                "design_image_url": design_image_url,
                "needed": net_needed,
                "order_ids": {oid for oid in (order_ids or []) if oid is not None},
            }
        )
    return rows


async def _finished_on_hand_map(
    db: AsyncSession, *, company_id: uuid.UUID, demand_rows: list[dict]
) -> dict[uuid.UUID, int]:
    """``{design_variation_id: on_hand}`` (entries - exits) for the demand SKUs.

    Demand variations are design-specific (``Product.print_id IS NOT NULL``), but
    the stock ledger is keyed to base variations (same spec x color x size, but
    from the no-print product).  We bridge via ``(spec_id, color_code, size)``:
    find the base variation for each demand natkey, sum its stock ledger, then
    re-key the result back to the design variation id so callers stay unchanged.
    """

    if not demand_rows:
        return {}

    # Build natkey → design variation id (first wins; natkey is 1:1 with demand row).
    natkey_to_vid: dict[tuple[uuid.UUID, str, Size], uuid.UUID] = {}
    for r in demand_rows:
        nk = (r["spec_id"], r["color_code"], r["size"])
        natkey_to_vid.setdefault(nk, r["variation_id"])

    spec_ids = {nk[0] for nk in natkey_to_vid}
    color_codes = {nk[1] for nk in natkey_to_vid}
    sizes = {nk[2] for nk in natkey_to_vid}

    # Find the base (no-print) product variation for each natkey.
    base_stmt = (
        select(ProductVariation.id, Product.spec_id, ProductVariation.color_code, ProductVariation.size)
        .join(Product, Product.id == ProductVariation.product_id)
        .where(
            ProductVariation.company_id == company_id,
            Product.print_id.is_(None),  # type: ignore[union-attr]
            Product.spec_id.in_(spec_ids),  # type: ignore[union-attr]
            ProductVariation.color_code.in_(color_codes),  # type: ignore[union-attr]
            ProductVariation.size.in_(sizes),  # type: ignore[union-attr]
        )
    )
    # base variation id → the demand variation id it covers
    base_to_design: dict[uuid.UUID, uuid.UUID] = {}
    for base_vid, spec_id, color_code, size in (await db.exec(base_stmt)).all():
        nk = (spec_id, color_code, size)
        design_vid = natkey_to_vid.get(nk)
        if design_vid is not None:
            base_to_design[base_vid] = design_vid

    if not base_to_design:
        return {}

    base_vids = set(base_to_design)
    entries_stmt = (
        select(StockEntry.variation_id, func.coalesce(func.sum(StockEntry.quantity), 0))
        .where(StockEntry.company_id == company_id, StockEntry.variation_id.in_(base_vids))  # type: ignore[union-attr]
        .group_by(StockEntry.variation_id)
    )
    exits_stmt = (
        select(StockExit.variation_id, func.coalesce(func.sum(StockExit.quantity), 0))
        .where(StockExit.company_id == company_id, StockExit.variation_id.in_(base_vids))  # type: ignore[union-attr]
        .group_by(StockExit.variation_id)
    )

    base_on_hand: dict[uuid.UUID, int] = {}
    for base_vid, total in (await db.exec(entries_stmt)).all():
        base_on_hand[base_vid] = int(total or 0)
    for base_vid, total in (await db.exec(exits_stmt)).all():
        base_on_hand[base_vid] = base_on_hand.get(base_vid, 0) - int(total or 0)

    # Re-key to design variation ids.
    result: dict[uuid.UUID, int] = {}
    for base_vid, on_hand in base_on_hand.items():
        design_vid = base_to_design[base_vid]
        result[design_vid] = result.get(design_vid, 0) + max(0, on_hand)
    return result


async def _printed_in_production_map(db: AsyncSession, *, company_id: uuid.UUID) -> dict[uuid.UUID, int]:
    """``{print_design_id: wip}`` for printed transfers in production.

    ``wip = Σ max(0, planned_quantity - printed_quantity)`` over ``PrintOrderOutput``
    of non-DONE ``PrintOrder``s, summed across all variations and sides (a printed
    order produces the design regardless of side — matches the prototype's
    ``printedInProduction`` which sums the whole order's ``planned - printed``).
    """

    open_qty = func.coalesce(
        func.sum(
            case(
                (
                    PrintOrderOutput.planned_quantity > PrintOrderOutput.printed_quantity,
                    PrintOrderOutput.planned_quantity - PrintOrderOutput.printed_quantity,
                ),
                else_=0,
            )
        ),
        0,
    )
    stmt = (
        select(PrintOrder.print_design_id, open_qty)
        .select_from(PrintOrder)
        .join(PrintOrderOutput, PrintOrderOutput.print_order_id == PrintOrder.id)
        .where(PrintOrder.company_id == company_id, PrintOrder.status != PrintOrderStatus.DONE)
        .group_by(PrintOrder.print_design_id)
    )
    return {design_id: int(total or 0) for design_id, total in (await db.exec(stmt)).all()}


async def _product_type_by_spec(db: AsyncSession, *, company_id: uuid.UUID) -> dict[uuid.UUID, ProductType]:
    """``{spec_id: product_type}`` from a representative product per spec.

    ``ProductSpec`` carries no garment type; the frontend glyph needs one. Take
    any product of the spec (one bulk query); specs with no product fall back to
    ``ProductType.CAMISETA`` at the call site (mirrors ``assembly._DEFAULT_PRODUCT_TYPE``).
    """

    stmt = select(Product.spec_id, Product.product_type).where(Product.company_id == company_id)
    result: dict[uuid.UUID, ProductType] = {}
    for spec_id, product_type in (await db.exec(stmt)).all():
        result.setdefault(spec_id, product_type)
    return result


# ------------------------------------------------------------ blank/printed rows


async def _blank_catalog(db: AsyncSession, *, company_id: uuid.UUID) -> list[BlankPiece]:
    return list((await db.exec(select(BlankPiece).where(BlankPiece.company_id == company_id))).all())


async def _front_printed_id_by_design(db: AsyncSession, *, company_id: uuid.UUID) -> dict[uuid.UUID, uuid.UUID]:
    """``{print_design_id: printed_transfer_id}`` for the FRONT side (one each).

    FRONT is the reference component (prototype ``printedFor``). The
    ``(design, side)`` unique constraint means at most one FRONT transfer per
    design, so ``setdefault`` is just defensive.
    """

    stmt = select(PrintedTransfer.id, PrintedTransfer.print_design_id).where(
        PrintedTransfer.company_id == company_id,
        PrintedTransfer.side == PrintSide.FRONT,
    )
    result: dict[uuid.UUID, uuid.UUID] = {}
    for transfer_id, design_id in (await db.exec(stmt)).all():
        result.setdefault(design_id, transfer_id)
    return result


async def _png_flag_by_design(
    db: AsyncSession, *, company_id: uuid.UUID, design_ids: set[uuid.UUID]
) -> dict[uuid.UUID, str]:
    """``{print_design_id: 'ok'|'pending'}`` from the chosen FRONT variation.

    Reports the front-artwork status of the variation that the bulk-create would
    use: the first FRONT-ready (``front_status == OK``) variation by
    ``created_at, id``, else the first variation. No variations → 'pending'.
    """

    if not design_ids:
        return {}
    stmt = (
        select(PrintDesignVariation)
        .where(
            PrintDesignVariation.company_id == company_id,
            PrintDesignVariation.print_design_id.in_(design_ids),  # type: ignore[union-attr]
        )
        .order_by(PrintDesignVariation.created_at, PrintDesignVariation.id)  # type: ignore[arg-type]
    )
    by_design: dict[uuid.UUID, list[PrintDesignVariation]] = {}
    for variation in (await db.exec(stmt)).all():
        by_design.setdefault(variation.print_design_id, []).append(variation)

    flags: dict[uuid.UUID, str] = {}
    for design_id, variations in by_design.items():
        chosen = next((v for v in variations if v.front_status == ArtworkStatus.OK), variations[0])
        flags[design_id] = "ok" if chosen.front_status == ArtworkStatus.OK else "pending"
    return flags


# ------------------------------------------------------------------ the engine


async def build_suggestions(db: AsyncSession, *, company_id: uuid.UUID) -> PlanningSuggestions:
    """Port of ``OrionDemand.build`` — the whole demand→production model (§1-3)."""

    settings = await settings_service.get_settings(db, company_id=company_id)
    config = settings.config

    demand_rows = await _open_demand_rows(db, company_id=company_id)

    # On-hand + WIP readers (bulk, reused verbatim).
    finished_map = await _finished_on_hand_map(db, company_id=company_id, demand_rows=demand_rows)
    blank_on_hand = await blank_stock_service.compute_on_hand_map(db, company_id=company_id)
    printed_on_hand = await printed_transfer_service.compute_on_hand_map(db, company_id=company_id)
    printed_wip_map = await _printed_in_production_map(db, company_id=company_id)
    product_type_by_spec = await _product_type_by_spec(db, company_id=company_id)

    blank_catalog = await _blank_catalog(db, company_id=company_id)
    # Blank lookup by (spec_id, color_code, size) → the catalog row.
    blank_by_key: dict[tuple[uuid.UUID, str, Size], BlankPiece] = {
        (b.spec_id, b.color_code, b.size): b for b in blank_catalog
    }
    front_printed_by_design = await _front_printed_id_by_design(db, company_id=company_id)

    # ── per-demand-SKU enrichment (prototype lines 114-132) ──
    skus: list[PlanningSku] = []
    for r in demand_rows:
        design_id = r["design_id"]
        if design_id is None:
            # No-print demand is cut-only — it resolves no (design, …) SKU.
            continue
        spec_id = r["spec_id"]
        color_code = r["color_code"]
        size = r["size"]

        finished = max(0, finished_map.get(r["variation_id"], 0))
        net = max(0, r["needed"] - finished)

        # Floor at 0 — a negative ledger balance is a data artifact, not stock we
        # can build from (and would otherwise inflate the shortfall).
        blank = blank_by_key.get((spec_id, color_code, size))
        blank_have = max(0, blank_on_hand.get(blank.id, 0)) if blank is not None else 0
        printed_id = front_printed_by_design.get(design_id)
        printed_have = max(0, printed_on_hand.get(printed_id, 0)) if printed_id is not None else 0

        blank_short = max(0, net - blank_have)
        printed_short = max(0, net - printed_have)
        buildable = max(0, min(net, blank_have, printed_have))

        state: PlanningState
        if blank_short > 0 and printed_short > 0:
            state = "ambos"
        elif blank_short > 0:
            state = "lisa"
        elif printed_short > 0:
            state = "impresso"
        else:
            state = "pronto"

        skus.append(
            PlanningSku(
                key=f"{design_id}|{spec_id}|{color_code}|{size.value}",
                design=PrintDesignRef(
                    id=design_id,
                    code=r["design_code"],
                    name=r["design_name"],
                    technique=r["design_technique"],
                    image_url=r["design_image_url"],
                ),
                spec=PlanningSpecRef(id=spec_id, code=r["spec_code"], name=r["spec_name"]),
                product_type=product_type_by_spec.get(spec_id, ProductType.CAMISETA),
                color=r["color"],
                color_code=color_code,
                size=size,
                needed=r["needed"],
                finished=finished,
                net=net,
                blank_have=blank_have,
                printed_have=printed_have,
                blank_short=blank_short,
                printed_short=printed_short,
                buildable=buildable,
                state=state,
                order_count=len(r["order_ids"]),
            )
        )
    skus.sort(key=lambda s: s.needed, reverse=True)

    cortes = await _build_cortes(
        db,
        company_id=company_id,
        config=config,
        demand_rows=demand_rows,
        blank_catalog=blank_catalog,
        blank_on_hand=blank_on_hand,
        finished_map=finished_map,
        product_type_by_spec=product_type_by_spec,
    )
    impressoes = await _build_impressoes(
        db,
        company_id=company_id,
        config=config,
        demand_rows=demand_rows,
        printed_on_hand=printed_on_hand,
        printed_wip_map=printed_wip_map,
        front_printed_by_design=front_printed_by_design,
        finished_map=finished_map,
    )

    totals = PlanningTotals(
        toCut=sum(c.total for c in cortes),
        toPrint=sum(i.total for i in impressoes),
        cortes=len(cortes),
        impressoes=len(impressoes),
        demandDriven=sum(1 for c in cortes if c.demand > 0) + sum(1 for i in impressoes if i.demand > 0),
        stockDriven=sum(1 for c in cortes if c.stock > 0) + sum(1 for i in impressoes if i.stock > 0),
    )

    return PlanningSuggestions(skus=skus, cortes=cortes, impressoes=impressoes, totals=totals)


def _net_for_row(r: dict, finished_map: dict[uuid.UUID, int]) -> int:
    finished = max(0, finished_map.get(r["variation_id"], 0))
    return max(0, r["needed"] - finished)


async def _build_cortes(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    config: dict,
    demand_rows: list[dict],
    blank_catalog: list[BlankPiece],
    blank_on_hand: dict[uuid.UUID, int],
    finished_map: dict[uuid.UUID, int],
    product_type_by_spec: dict[uuid.UUID, ProductType],
) -> list[PlanningCorte]:
    """Cortes engine — per blank tier ``(spec_id, color_code, size)`` → grouped per ``(spec_id, color_code)``."""

    blank_threshold = _threshold_value(config, "blank")

    # The union of blank-tier keys we must compute WIP for: catalog keys + demand keys.
    catalog_keys = {(b.spec_id, b.color_code, b.size) for b in blank_catalog}
    demand_keys = {(r["spec_id"], r["color_code"], r["size"]) for r in demand_rows if _net_for_row(r, finished_map) > 0}
    in_production = await blank_stock_service._in_production_map(
        db, company_id=company_id, keys=catalog_keys | demand_keys
    )

    # Seed ``blankNeed`` from the catalog (prototype lines 139-145).
    blank_need: dict[tuple[uuid.UUID, str, Size], dict[str, Any]] = {}
    color_by_code: dict[tuple[uuid.UUID, str], str] = {}
    for b in blank_catalog:
        key = (b.spec_id, b.color_code, b.size)
        effective_min = b.min_stock if b.min_stock is not None else blank_threshold
        blank_need[key] = {
            "spec_id": b.spec_id,
            "color_code": b.color_code,
            "size": b.size,
            "color": b.color,
            "count": blank_on_hand.get(b.id, 0),
            "min": effective_min,
            "wip": in_production.get(key, 0),
            "demand": 0,
            "orders": set(),
        }
        color_by_code[(b.spec_id, b.color_code)] = b.color

    # Fold demand into ``blankNeed`` (prototype lines 146-156).
    for r in demand_rows:
        net = _net_for_row(r, finished_map)
        if net <= 0:
            continue
        key = (r["spec_id"], r["color_code"], r["size"])
        entry: dict[str, Any] | None = blank_need.get(key)
        if entry is None:
            entry = {
                "spec_id": r["spec_id"],
                "color_code": r["color_code"],
                "size": r["size"],
                "color": r["color"],
                "count": 0,
                "min": 0,
                "wip": in_production.get(key, 0),
                "demand": 0,
                "orders": set(),
            }
            blank_need[key] = entry
        entry["demand"] += net
        entry["orders"] |= r["order_ids"]
        # Carry a colour label + spec ref for a tier that exists only in demand.
        color_by_code.setdefault((r["spec_id"], r["color_code"]), r["color"])

    # Per-tier shortfall, then group by (spec_id, color_code) (prototype lines 158-170).
    corte_map: dict[tuple[uuid.UUID, str], dict[str, Any]] = {}
    # Spec display refs (code/name) collected from demand rows; catalog tiers fall
    # back to a loaded spec below.
    spec_ref_by_id: dict[uuid.UUID, PlanningSpecRef] = {}
    for r in demand_rows:
        spec_ref_by_id.setdefault(
            r["spec_id"], PlanningSpecRef(id=r["spec_id"], code=r["spec_code"], name=r["spec_name"])
        )

    for entry in blank_need.values():
        # Floor on-hand + WIP at 0: a negative ledger balance (an import/data
        # artifact — you can't physically hold < 0 blanks) must NOT be read as
        # extra demand to produce, or it inflates the cut suggestion by |deficit|.
        count = max(0, entry["count"])
        wip = max(0, entry["wip"])
        demand_short = max(0, entry["demand"] - count - wip)
        after_demand = max(0, count + wip - entry["demand"])
        stock_short = max(0, entry["min"] - after_demand)
        total = demand_short + stock_short
        if total <= 0:
            continue
        group_key = (entry["spec_id"], entry["color_code"])
        group: dict[str, Any] | None = corte_map.get(group_key)
        if group is None:
            group = {
                "spec_id": entry["spec_id"],
                "color_code": entry["color_code"],
                "color": color_by_code.get(group_key, entry["color"]),
                "grade": [],
                "total": 0,
                "demand": 0,
                "stock": 0,
                "orders": set(),
            }
            corte_map[group_key] = group
        group["grade"].append(
            PlanningCorteGradeRow(size=entry["size"], qty=total, demand_qty=demand_short, stock_qty=stock_short)
        )
        group["total"] += total
        group["demand"] += demand_short
        group["stock"] += stock_short
        group["orders"] |= entry["orders"]

    # Load spec refs for any group whose spec wasn't in the demand rows (catalog-only).
    missing_spec_ids = {gk[0] for gk in corte_map if gk[0] not in spec_ref_by_id}
    if missing_spec_ids:
        spec_stmt = select(ProductSpec).where(
            ProductSpec.company_id == company_id,
            ProductSpec.id.in_(missing_spec_ids),  # type: ignore[union-attr]
        )
        for spec in (await db.exec(spec_stmt)).all():
            spec_ref_by_id[spec.id] = PlanningSpecRef(id=spec.id, code=spec.code, name=spec.name)

    cortes: list[PlanningCorte] = []
    for (spec_id, color_code), group in corte_map.items():
        grade_rows = sorted(group["grade"], key=lambda g: _SIZE_ORDER.get(g.size, len(_SIZE_ORDER)))
        sources: list[SuggestionSource] = []
        if group["demand"] > 0:
            sources.append("demanda")
        if group["stock"] > 0:
            sources.append("estoque")
        cortes.append(
            PlanningCorte(
                key=f"{spec_id}|{color_code}",
                spec=spec_ref_by_id[spec_id],
                product_type=product_type_by_spec.get(spec_id, ProductType.CAMISETA),
                color=group["color"],
                color_code=color_code,
                total=group["total"],
                demand=group["demand"],
                stock=group["stock"],
                order_count=len(group["orders"]),
                grade_rows=grade_rows,
                sources=sources,
            )
        )
    cortes.sort(key=lambda c: c.total, reverse=True)
    return cortes


async def _build_impressoes(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    config: dict,
    demand_rows: list[dict],
    printed_on_hand: dict[uuid.UUID, int],
    printed_wip_map: dict[uuid.UUID, int],
    front_printed_by_design: dict[uuid.UUID, uuid.UUID],
    finished_map: dict[uuid.UUID, int],
) -> list[PlanningImpressao]:
    """Impressões engine — per print design (FRONT as reference) → one suggestion each.

    Silkscreen designs are excluded (not transfer-based — a print order would 422).
    """

    printed_threshold = _threshold_value(config, "printed")

    # Seed ``imprNeed`` from the FRONT printed-transfer catalog (prototype 179-186),
    # then fold demand (187-197). Silkscreen designs are skipped on both paths.
    impr_need: dict[uuid.UUID, dict[str, Any]] = {}

    # Load the design rows we may touch (catalog FRONT designs + demand designs).
    catalog_design_ids = set(front_printed_by_design.keys())
    demand_design_ids = {
        r["design_id"] for r in demand_rows if r["design_id"] is not None and _net_for_row(r, finished_map) > 0
    }
    design_ids = catalog_design_ids | demand_design_ids
    designs: dict[uuid.UUID, PrintDesign] = {}
    if design_ids:
        design_stmt = select(PrintDesign).where(
            PrintDesign.company_id == company_id,
            PrintDesign.id.in_(design_ids),  # type: ignore[union-attr]
        )
        designs = {d.id: d for d in (await db.exec(design_stmt)).all()}

    for design_id, transfer_id in front_printed_by_design.items():
        design = designs.get(design_id)
        if design is None or design.technique == PrintTechnique.SILKSCREEN:
            continue
        # Row-level min_stock would require loading the PrintedTransfer; the
        # seeding uses the per-row min if set else the company threshold. We load
        # the transfer's min via the printed catalog map below; here default to
        # the company threshold (overridden if a row min exists).
        impr_need[design_id] = {
            "design_id": design_id,
            "count": printed_on_hand.get(transfer_id, 0),
            "min": printed_threshold,
            "wip": printed_wip_map.get(design_id, 0),
            "demand": 0,
            "orders": set(),
        }

    # Apply per-row printed min_stock overrides for the FRONT transfers we seeded.
    await _apply_printed_min_overrides(
        db, company_id=company_id, impr_need=impr_need, front_printed_by_design=front_printed_by_design
    )

    for r in demand_rows:
        net = _net_for_row(r, finished_map)
        if net <= 0:
            continue
        design_id = r["design_id"]
        if design_id is None:
            continue  # no-print demand → cut-only, never an impressão
        if r["design_technique"] == PrintTechnique.SILKSCREEN:
            continue
        entry: dict[str, Any] | None = impr_need.get(design_id)
        if entry is None:
            design = designs.get(design_id)
            if design is not None and design.technique == PrintTechnique.SILKSCREEN:
                continue
            transfer_id = front_printed_by_design.get(design_id)
            entry = {
                "design_id": design_id,
                "count": printed_on_hand.get(transfer_id, 0) if transfer_id is not None else 0,
                "min": 0,
                "wip": printed_wip_map.get(design_id, 0),
                "demand": 0,
                "orders": set(),
            }
            impr_need[design_id] = entry
        entry["demand"] += net
        entry["orders"] |= r["order_ids"]

    png_flags = await _png_flag_by_design(db, company_id=company_id, design_ids=set(impr_need.keys()))

    impressoes: list[PlanningImpressao] = []
    for design_id, entry in impr_need.items():
        # Floor on-hand + WIP at 0 (negative = ledger artifact, not buildable stock).
        count = max(0, entry["count"])
        wip = max(0, entry["wip"])
        demand_short = max(0, entry["demand"] - count - wip)
        after_demand = max(0, count + wip - entry["demand"])
        stock_short = max(0, entry["min"] - after_demand)
        total = demand_short + stock_short
        if total <= 0:
            continue
        design = designs.get(design_id)
        if design is None:  # pragma: no cover — design_ids covers every key
            continue
        sources: list[SuggestionSource] = []
        if demand_short > 0:
            sources.append("demanda")
        if stock_short > 0:
            sources.append("estoque")
        impressoes.append(
            PlanningImpressao(
                key=str(design_id),
                design=PrintDesignRef(
                    id=design.id,
                    code=design.code,
                    name=design.name,
                    technique=design.technique,
                    image_url=design.image_url,
                ),
                total=total,
                demand=demand_short,
                stock=stock_short,
                order_count=len(entry["orders"]),
                png=png_flags.get(design_id, "pending"),  # type: ignore[arg-type]
                sources=sources,
            )
        )
    impressoes.sort(key=lambda i: i.total, reverse=True)
    return impressoes


async def _apply_printed_min_overrides(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    impr_need: dict[uuid.UUID, dict[str, Any]],
    front_printed_by_design: dict[uuid.UUID, uuid.UUID],
) -> None:
    """Override seeded ``min`` with the FRONT transfer's row ``min_stock`` when set."""

    transfer_ids = {front_printed_by_design[d] for d in impr_need if d in front_printed_by_design}
    if not transfer_ids:
        return
    stmt = select(PrintedTransfer).where(
        PrintedTransfer.company_id == company_id,
        PrintedTransfer.id.in_(transfer_ids),  # type: ignore[union-attr]
    )
    min_by_design: dict[uuid.UUID, int] = {}
    for transfer in (await db.exec(stmt)).all():
        if transfer.min_stock is not None:
            min_by_design[transfer.print_design_id] = transfer.min_stock
    for design_id, row_min in min_by_design.items():
        if design_id in impr_need:
            impr_need[design_id]["min"] = row_min


# ------------------------------------------------------------- bulk-create: cut


async def create_cutting_orders(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    keys: list[str],
) -> PlanningCutResult:
    """Recompute suggestions, then create a PENDING corte per selected key (§5a).

    Each create delegates to ``cutting.create_cutting_order`` with no roll
    assigned (planning draft); the grade = the suggestion's per-size grade
    (qty = demand + stock). Keys absent from the fresh recompute are ``stale``.
    """

    suggestions = await build_suggestions(db, company_id=company_id)
    by_key = {c.key: c for c in suggestions.cortes}

    created: list[PlanningCutCreated] = []
    skipped: list[PlanningSkipped] = []
    for key in keys:
        corte = by_key.get(key)
        if corte is None:
            skipped.append(PlanningSkipped(key=key, reason="stale"))
            continue
        payload = CuttingCreate(
            spec_id=corte.spec.id,
            color=corte.color,
            color_code=corte.color_code,
            body_roll_id=None,
            rib_roll_id=None,
            planned_outputs=[OutputItem(size=g.size, quantity=g.qty) for g in corte.grade_rows],
            cut_at=None,
        )
        try:
            order = await cutting_service.create_cutting_order(
                db, company_id=company_id, user_id=user_id, payload=payload
            )
        except ValidationError:
            # The spec vanished between recompute and create (concurrent delete).
            skipped.append(PlanningSkipped(key=key, reason="spec_not_found"))
            continue
        created.append(
            PlanningCutCreated(
                key=key,
                cutting_order_id=order.id,
                code=f"CO-{order.id.hex[:8].upper()}",
                total=corte.total,
            )
        )

    return PlanningCutResult(created=created, skipped=skipped, created_count=len(created))


# ----------------------------------------------------------- bulk-create: print


async def create_print_orders(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    keys: list[str],
) -> PlanningPrintResult:
    """Recompute suggestions, then create a PENDING impressão per selected key (§5b).

    Each create delegates to ``print_order.create_print_order`` with no paper
    assigned and ONE FRONT output row (the resolved FRONT variation, planned =
    total). Designs with no variation / no front side / silkscreen are skipped
    (reported), never crashing the batch.
    """

    suggestions = await build_suggestions(db, company_id=company_id)
    by_key = {i.key: i for i in suggestions.impressoes}

    created: list[PlanningPrintCreated] = []
    skipped: list[PlanningPrintSkipped] = []
    for key in keys:
        impressao = by_key.get(key)
        if impressao is None:
            skipped.append(PlanningPrintSkipped(key=key, reason="stale"))
            continue

        design_id = impressao.design.id
        if impressao.design.technique == PrintTechnique.SILKSCREEN:
            skipped.append(PlanningPrintSkipped(key=key, reason="silkscreen"))
            continue

        variation = await _resolve_front_variation(db, company_id=company_id, design_id=design_id)
        if variation is None:
            skipped.append(PlanningPrintSkipped(key=key, reason="no_variation"))
            continue

        payload = PrintOrderCreate(
            print_design_id=design_id,
            paper_roll_id=None,
            planned_outputs=[
                PrintOrderOutputItem(
                    print_design_variation_id=variation.id,
                    side=PrintSide.FRONT,
                    planned_quantity=impressao.total,
                )
            ],
        )
        try:
            order = await print_order_service.create_print_order(
                db, company_id=company_id, user_id=user_id, payload=payload
            )
        except ValidationError as exc:
            # ``_validate_outputs`` rejects FRONT on a back-only design; silkscreen
            # is caught above but guard defensively too.
            detail = str(getattr(exc, "detail", "")).lower()
            if "front" in detail:
                skipped.append(PlanningPrintSkipped(key=key, reason="no_front_side"))
            elif "silkscreen" in detail:
                skipped.append(PlanningPrintSkipped(key=key, reason="silkscreen"))
            else:  # pragma: no cover — unexpected validation
                skipped.append(PlanningPrintSkipped(key=key, reason="no_variation"))
            continue
        created.append(PlanningPrintCreated(key=key, print_order_id=order.id, code=order.code, total=impressao.total))

    return PlanningPrintResult(created=created, skipped=skipped, created_count=len(created))


async def _resolve_front_variation(
    db: AsyncSession, *, company_id: uuid.UUID, design_id: uuid.UUID
) -> PrintDesignVariation | None:
    """Pick the FRONT variation for a design (§5b): first FRONT-ready, else first, else None."""

    stmt = (
        select(PrintDesignVariation)
        .where(
            PrintDesignVariation.company_id == company_id,
            PrintDesignVariation.print_design_id == design_id,
        )
        .order_by(PrintDesignVariation.created_at, PrintDesignVariation.id)  # type: ignore[arg-type]
    )
    variations = list((await db.exec(stmt)).all())
    if not variations:
        return None
    return next((v for v in variations if v.front_status == ArtworkStatus.OK), variations[0])


__all__ = [
    "build_suggestions",
    "create_cutting_orders",
    "create_print_orders",
]
