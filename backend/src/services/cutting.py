"""Service layer for the Cutting (Corte) feature.

Convention notes
----------------
- Every SELECT is :func:`scoped` to the active tenant.
- ``company_id`` is set explicitly on every insert (cutting orders carry
  the tenant; output rows are child rows of a tenant-scoped order).
- Mutations append an audit-log entry under the ``cutting_orders``
  resource type. Status transitions write a human-readable message
  ("Marked cutting CO-XXXX as DONE") so the audit timeline is legible.
- One row per ``(cutting_order_id, size)`` lives in
  :class:`CuttingOrderOutput`. Both ``planned_outputs`` and
  ``actual_outputs`` are projected from this row set:

  * On create, the rows represent the *planned* set; actuals are empty
    until the operator records them.
  * On PATCH with ``actual_outputs``, the rows are **replaced** in a single
    flush with the operator-provided values. After that point the same
    rows are exposed as ``actual_outputs`` and re-exposed as
    ``planned_outputs`` (the original planned snapshot is not preserved
    independently — the model carries one row per size).

  The single source of truth shape mirrors the design's "Planejado /
  Cortado" grid: a single editable list per size, with the operator
  overwriting the targets as the floor reports progress.

- DELETE is blocked when at least one ``SewingShipment`` references the
  order (RESTRICT FK + an explicit pre-check so we surface a friendly
  409 instead of the FK-violation translated to an opaque error).
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import String, cast, func, or_
from sqlalchemy.exc import IntegrityError
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    CuttingOrder,
    CuttingOrderOutput,
    CuttingRunCost,
    CuttingStatus,
    FabricRoll,
    Product,
    ProductSpec,
    SewingShipment,
    Size,
    SpecTrim,
)
from schemas._common import PageParams
from schemas.cutting import (
    CuttingCreate,
    CuttingFilters,
    CuttingOutputRead,
    CuttingRead,
    CuttingUpdate,
    ProductRef,
    RollRef,
)
from schemas.cutting_cost import CuttingCostRead
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError, ValidationError

_RESOURCE = "cutting_orders"

# Quantisation helpers — keep all arithmetic in Decimal and round to the
# column scales so the persisted snapshot matches what we serialise.
_KG = Decimal("0.001")
_MONEY = Decimal("0.01")
_MONEY4 = Decimal("0.0001")
_YIELD = Decimal("0.001")


# ---------------------------------------------------------------------- helpers


def _short_id(value: uuid.UUID) -> str:
    """Compact identifier used in audit messages and the wire ``code``."""

    return value.hex[:8].upper()


def _roll_code(roll: FabricRoll | None) -> str | None:
    """Stable, compact roll identifier the UI uses in cards and tables."""

    if roll is None:
        return None
    return f"BB-{roll.id.hex[:6].upper()}"


def _outputs_to_read(
    outputs: list[CuttingOrderOutput],
) -> list[CuttingOutputRead]:
    return [CuttingOutputRead(size=o.size, quantity=o.quantity) for o in outputs]


def _to_read(
    order: CuttingOrder,
    *,
    product: Product,
    spec: ProductSpec | None,
    body_roll: FabricRoll,
    rib_roll: FabricRoll | None,
    outputs: list[CuttingOrderOutput],
) -> CuttingRead:
    """Project the loaded entity graph onto the public ``CuttingRead`` shape."""

    items = sorted(outputs, key=lambda row: row.size.value)
    planned = _outputs_to_read(items)
    # Until the operator records progress (status != pending or cut_at set),
    # we expose actuals as an empty list. After that the rows have been
    # rewritten by the operator and we expose them under both keys — see
    # the module docstring for the rationale.
    actuals: list[CuttingOutputRead] = []
    if order.status != CuttingStatus.PENDING or order.cut_at is not None:
        actuals = _outputs_to_read(items)
    return CuttingRead(
        id=order.id,
        product=ProductRef(id=product.id, name=product.name, code=spec.code if spec else None),
        body_roll=RollRef(id=body_roll.id, code=_roll_code(body_roll) or ""),
        rib_roll=RollRef(id=rib_roll.id, code=_roll_code(rib_roll) or "") if rib_roll else None,
        status=order.status,
        planned_outputs=planned,
        actual_outputs=actuals,
        cut_at=order.cut_at,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


# ---------------------------------------------------------------------- queries


async def _outputs_for(db: AsyncSession, order_id: uuid.UUID) -> list[CuttingOrderOutput]:
    stmt = (
        select(CuttingOrderOutput)
        .where(CuttingOrderOutput.cutting_order_id == order_id)
        .order_by(CuttingOrderOutput.size, CuttingOrderOutput.created_at)  # type: ignore[arg-type]
    )
    return list((await db.exec(stmt)).all())


async def _load_with_relations(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    order_id: uuid.UUID,
) -> tuple[CuttingOrder, Product, ProductSpec | None, FabricRoll, FabricRoll | None, list[CuttingOrderOutput]]:
    stmt = scoped(select(CuttingOrder), CuttingOrder, company_id).where(CuttingOrder.id == order_id)
    order = (await db.exec(stmt)).first()
    if order is None:
        raise NotFoundError(detail="Cutting order not found")

    product = (await db.exec(select(Product).where(Product.id == order.product_id))).first()
    if product is None:  # pragma: no cover — FK-guarded at the DB layer
        raise NotFoundError(detail="Cutting order references a missing product")
    spec = (await db.exec(select(ProductSpec).where(ProductSpec.id == product.spec_id))).first()
    body = (await db.exec(select(FabricRoll).where(FabricRoll.id == order.body_roll_id))).first()
    if body is None:  # pragma: no cover — FK-guarded at the DB layer
        raise NotFoundError(detail="Cutting order references a missing body roll")
    rib: FabricRoll | None = None
    if order.rib_roll_id is not None:
        rib = (await db.exec(select(FabricRoll).where(FabricRoll.id == order.rib_roll_id))).first()
    outputs = await _outputs_for(db, order.id)
    return order, product, spec, body, rib, outputs


def _cost_to_read(row: CuttingRunCost) -> CuttingCostRead:
    """Narrow the persisted Decimal snapshot to the float wire shape."""

    return CuttingCostRead(
        cutting_order_id=row.cutting_order_id,
        total_pieces=row.total_pieces,
        body_fabric_kg=float(row.body_fabric_kg),
        ribana_kg=float(row.ribana_kg),
        body_price_per_kg=float(row.body_price_per_kg),
        rib_price_per_kg=float(row.rib_price_per_kg) if row.rib_price_per_kg is not None else None,
        fabric_cost=float(row.fabric_cost),
        ribana_cost=float(row.ribana_cost),
        trims_cost=float(row.trims_cost),
        labor_cost=float(row.labor_cost),
        total_cost=float(row.total_cost),
        cost_per_piece=float(row.cost_per_piece),
        yield_pieces_per_kg=float(row.yield_pieces_per_kg),
    )


async def _trims_total_for_spec(db: AsyncSession, *, spec_id: uuid.UUID) -> Decimal:
    """Sum ``unit_price x quantity`` across a spec's trims (per piece)."""

    stmt = select(SpecTrim).where(SpecTrim.spec_id == spec_id)
    trims = (await db.exec(stmt)).all()
    total = Decimal("0")
    for trim in trims:
        total += Decimal(str(trim.unit_price)) * Decimal(trim.quantity)
    return total


async def _compute_and_store_cost(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    order: CuttingOrder,
    spec: ProductSpec | None,
    body_roll: FabricRoll,
    rib_roll: FabricRoll | None,
    outputs: list[CuttingOrderOutput],
) -> None:
    """Compute the frozen per-run cost and upsert the ``CuttingRunCost`` row.

    Consumed fabric weight is *derived* from the spec's per-piece weight
    (and ribana percentage) — the cutting flow never mutates a roll's
    ``current_weight_kg``, so cost must not depend on roll-weight deltas.
    All prices/weights/piece-count are persisted so the record is an
    immutable snapshot even if the spec or roll prices change later.

    The row is replaced (delete-then-insert) so a second DONE transition
    after a revert to CUTTING does not violate the UNIQUE constraint.
    """

    total_pieces = sum(o.quantity for o in outputs)

    # Per-piece body weight (grams → kg). Spec is FK-guaranteed in practice,
    # but guard defensively: a missing spec yields a zero-cost record rather
    # than a crash on a DONE transition.
    weight_per_piece_g = Decimal(str(spec.fabric_weight_per_piece_g)) if spec is not None else Decimal("0")
    body_fabric_kg = (Decimal(total_pieces) * weight_per_piece_g / Decimal("1000")).quantize(_KG)

    has_ribana = bool(spec.has_ribana) if spec is not None else False
    ribana_pct = (
        Decimal(str(spec.ribana_weight_pct))
        if spec is not None and spec.has_ribana and spec.ribana_weight_pct is not None
        else Decimal("0")
    )
    ribana_kg = (body_fabric_kg * ribana_pct / Decimal("100")).quantize(_KG) if has_ribana else Decimal("0.000")

    body_price = Decimal(str(body_roll.price_per_kg))
    # Ribana is cut from the rib roll when present, else from the body roll.
    rib_price = Decimal(str(rib_roll.price_per_kg)) if rib_roll is not None else body_price

    fabric_cost = (body_fabric_kg * body_price).quantize(_MONEY)
    ribana_cost = (ribana_kg * rib_price).quantize(_MONEY) if has_ribana else Decimal("0.00")

    trims_per_piece = await _trims_total_for_spec(db, spec_id=spec.id) if spec is not None else Decimal("0")
    trims_cost = (trims_per_piece * Decimal(total_pieces)).quantize(_MONEY)

    labor_per_piece = Decimal(str(spec.labor_cost)) if spec is not None else Decimal("0")
    labor_cost = (labor_per_piece * Decimal(total_pieces)).quantize(_MONEY)

    total_cost = (fabric_cost + ribana_cost + trims_cost + labor_cost).quantize(_MONEY)

    cost_per_piece = (total_cost / Decimal(total_pieces)).quantize(_MONEY4) if total_pieces > 0 else Decimal("0.0000")

    total_consumed_kg = (body_fabric_kg + ribana_kg).quantize(_KG)
    yield_pieces_per_kg = (
        (Decimal(total_pieces) / total_consumed_kg).quantize(_YIELD) if total_consumed_kg > 0 else Decimal("0.000")
    )

    # Upsert: drop any prior snapshot, then insert the freshly computed one.
    await db.exec(
        delete(CuttingRunCost).where(CuttingRunCost.cutting_order_id == order.id)  # type: ignore[arg-type]
    )
    await db.flush()
    db.add(
        CuttingRunCost(
            company_id=company_id,
            cutting_order_id=order.id,
            total_pieces=total_pieces,
            body_fabric_kg=body_fabric_kg,
            ribana_kg=ribana_kg,
            body_price_per_kg=body_price,
            rib_price_per_kg=rib_price if rib_roll is not None else None,
            fabric_cost=fabric_cost,
            ribana_cost=ribana_cost,
            trims_cost=trims_cost,
            labor_cost=labor_cost,
            total_cost=total_cost,
            cost_per_piece=cost_per_piece,
            yield_pieces_per_kg=yield_pieces_per_kg,
        )
    )
    await db.flush()


async def get_cutting_cost(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    order_id: uuid.UUID,
) -> CuttingCostRead:
    """Return the frozen cost breakdown for a cutting order.

    Raises :class:`NotFoundError` when the order does not exist for the
    tenant *or* when its cost has not been computed yet (the order has
    never reached ``DONE``). Both surface as a 404 at the router.
    """

    order_stmt = scoped(select(CuttingOrder), CuttingOrder, company_id).where(CuttingOrder.id == order_id)
    order = (await db.exec(order_stmt)).first()
    if order is None:
        raise NotFoundError(detail="Cutting order not found")

    cost_stmt = scoped(select(CuttingRunCost), CuttingRunCost, company_id).where(
        CuttingRunCost.cutting_order_id == order_id
    )
    row = (await db.exec(cost_stmt)).first()
    if row is None:
        raise NotFoundError(detail="Cutting order cost not computed yet")
    return _cost_to_read(row)


def _apply_filters(stmt, filters: CuttingFilters):
    if filters.q:
        like = f"%{filters.q.strip().lower()}%"
        stmt = (
            stmt.join(Product, Product.id == CuttingOrder.product_id)
            .join(FabricRoll, FabricRoll.id == CuttingOrder.body_roll_id)
            .where(
                or_(
                    func.lower(Product.name).like(like),
                    func.lower(FabricRoll.supplier_name).like(like),
                    func.lower(cast(CuttingOrder.id, String)).like(like),
                )
            )
        )
    if filters.status is not None:
        stmt = stmt.where(CuttingOrder.status == filters.status)
    if filters.product_id is not None:
        stmt = stmt.where(CuttingOrder.product_id == filters.product_id)
    return stmt


async def list_cutting_orders(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: CuttingFilters,
    page: PageParams,
) -> tuple[list[CuttingRead], int]:
    base = scoped(select(CuttingOrder), CuttingOrder, company_id)
    filtered = _apply_filters(base, filters)

    count_stmt = scoped(select(func.count()).select_from(CuttingOrder), CuttingOrder, company_id)
    count_stmt = _apply_filters(count_stmt, filters)
    total = int((await db.exec(count_stmt)).one() or 0)

    items_stmt = (
        filtered.order_by(CuttingOrder.created_at.desc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    orders = list((await db.exec(items_stmt)).all())
    if not orders:
        return [], total

    product_ids = {o.product_id for o in orders}
    roll_ids = {o.body_roll_id for o in orders} | {o.rib_roll_id for o in orders if o.rib_roll_id is not None}
    order_ids = [o.id for o in orders]

    products_by_id = {
        p.id: p
        for p in (await db.exec(select(Product).where(Product.id.in_(product_ids)))).all()  # type: ignore[attr-defined]
    }
    spec_ids = {p.spec_id for p in products_by_id.values()}
    specs_by_id = {
        s.id: s
        for s in (await db.exec(select(ProductSpec).where(ProductSpec.id.in_(spec_ids)))).all()  # type: ignore[attr-defined]
    }
    rolls_by_id = {
        r.id: r
        for r in (await db.exec(select(FabricRoll).where(FabricRoll.id.in_(roll_ids)))).all()  # type: ignore[attr-defined]
    }
    outputs_by_order: dict[uuid.UUID, list[CuttingOrderOutput]] = {}
    outputs_stmt = (
        select(CuttingOrderOutput)
        .where(CuttingOrderOutput.cutting_order_id.in_(order_ids))  # type: ignore[attr-defined]
        .order_by(CuttingOrderOutput.size, CuttingOrderOutput.created_at)  # type: ignore[arg-type]
    )
    for row in (await db.exec(outputs_stmt)).all():
        outputs_by_order.setdefault(row.cutting_order_id, []).append(row)

    return (
        [
            _to_read(
                order,
                product=products_by_id[order.product_id],
                spec=specs_by_id.get(products_by_id[order.product_id].spec_id),
                body_roll=rolls_by_id[order.body_roll_id],
                rib_roll=rolls_by_id.get(order.rib_roll_id) if order.rib_roll_id else None,
                outputs=outputs_by_order.get(order.id, []),
            )
            for order in orders
        ],
        total,
    )


async def get_cutting_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    order_id: uuid.UUID,
) -> CuttingRead:
    order, product, spec, body, rib, outputs = await _load_with_relations(db, company_id=company_id, order_id=order_id)
    return _to_read(order, product=product, spec=spec, body_roll=body, rib_roll=rib, outputs=outputs)


# ----------------------------------------------------------------------- create


async def _assert_product_in_company(db: AsyncSession, *, company_id: uuid.UUID, product_id: uuid.UUID) -> Product:
    stmt = scoped(select(Product), Product, company_id).where(Product.id == product_id)
    product = (await db.exec(stmt)).first()
    if product is None:
        raise ValidationError(detail="Product not found for this company")
    return product


async def _assert_roll_in_company(db: AsyncSession, *, company_id: uuid.UUID, roll_id: uuid.UUID) -> FabricRoll:
    stmt = scoped(select(FabricRoll), FabricRoll, company_id).where(FabricRoll.id == roll_id)
    roll = (await db.exec(stmt)).first()
    if roll is None:
        raise ValidationError(detail="Fabric roll not found for this company")
    return roll


async def create_cutting_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: CuttingCreate,
) -> CuttingRead:
    if payload.rib_roll_id is not None and payload.rib_roll_id == payload.body_roll_id:
        # Surfaced as 409 so the frontend can render the same inline error
        # ("Bobina corpo e ribana devem ser diferentes") regardless of
        # whether validation tripped at the schema layer or here.
        raise ConflictError(detail="body_roll_id and rib_roll_id must be different")

    await _assert_product_in_company(db, company_id=company_id, product_id=payload.product_id)
    await _assert_roll_in_company(db, company_id=company_id, roll_id=payload.body_roll_id)
    if payload.rib_roll_id is not None:
        await _assert_roll_in_company(db, company_id=company_id, roll_id=payload.rib_roll_id)

    order = CuttingOrder(
        company_id=company_id,
        product_id=payload.product_id,
        body_roll_id=payload.body_roll_id,
        rib_roll_id=payload.rib_roll_id,
        status=CuttingStatus.PENDING,
        cut_at=payload.cut_at,
    )
    db.add(order)
    try:
        await db.flush()
    except IntegrityError as exc:  # pragma: no cover — DB-level safety net
        await db.rollback()
        raise ConflictError(detail="body_roll_id and rib_roll_id must be different") from exc

    for item in payload.planned_outputs:
        db.add(
            CuttingOrderOutput(
                cutting_order_id=order.id,
                size=item.size,
                quantity=item.quantity,
            )
        )
    if payload.planned_outputs:
        await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=order.id,
        message=f"Created cutting order CO-{_short_id(order.id)}",
    )
    await db.commit()
    return await get_cutting_order(db, company_id=company_id, order_id=order.id)


# ----------------------------------------------------------------------- update


_TRANSITIONS: dict[CuttingStatus, set[CuttingStatus]] = {
    CuttingStatus.PENDING: {CuttingStatus.CUTTING, CuttingStatus.DONE},
    CuttingStatus.CUTTING: {CuttingStatus.PENDING, CuttingStatus.DONE},
    CuttingStatus.DONE: {CuttingStatus.CUTTING},
}


def _assert_valid_transition(current: CuttingStatus, target: CuttingStatus) -> None:
    if current == target:
        return
    allowed = _TRANSITIONS.get(current, set())
    if target not in allowed:
        raise ConflictError(
            detail=f"Cannot transition cutting status from {current.value} to {target.value}",
        )


async def update_cutting_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
    payload: CuttingUpdate,
) -> CuttingRead:
    stmt = scoped(select(CuttingOrder), CuttingOrder, company_id).where(CuttingOrder.id == order_id)
    order = (await db.exec(stmt)).first()
    if order is None:
        raise NotFoundError(detail="Cutting order not found")

    data = payload.model_dump(exclude_unset=True)
    audit_messages: list[str] = []
    transitioned_to_done = False

    if "status" in data and data["status"] is not None:
        target = CuttingStatus(data["status"])
        _assert_valid_transition(order.status, target)
        if target != order.status:
            audit_messages.append(
                f"Marked cutting CO-{_short_id(order.id)} as {target.value.upper()}",
            )
            transitioned_to_done = target == CuttingStatus.DONE
            order.status = target

    if "cut_at" in data:
        order.cut_at = data["cut_at"]

    if "actual_outputs" in data and data["actual_outputs"] is not None:
        await db.exec(
            delete(CuttingOrderOutput).where(CuttingOrderOutput.cutting_order_id == order.id)  # type: ignore[arg-type]
        )
        await db.flush()
        for raw in data["actual_outputs"]:
            db.add(
                CuttingOrderOutput(
                    cutting_order_id=order.id,
                    size=Size(raw["size"]),
                    quantity=int(raw["quantity"]),
                )
            )
        await db.flush()
        audit_messages.append(
            f"Updated actual outputs for CO-{_short_id(order.id)}",
        )

    db.add(order)
    await db.flush()

    # Freeze the production cost the moment the order reaches DONE. We reload
    # the full entity graph (spec, rolls, outputs) so the snapshot reflects
    # any actual_outputs applied in this same request, then upsert the row.
    if transitioned_to_done:
        (
            done_order,
            _product,
            spec,
            body_roll,
            rib_roll,
            outputs,
        ) = await _load_with_relations(db, company_id=company_id, order_id=order.id)
        await _compute_and_store_cost(
            db,
            company_id=company_id,
            order=done_order,
            spec=spec,
            body_roll=body_roll,
            rib_roll=rib_roll,
            outputs=outputs,
        )
        audit_messages.append(f"Computed production cost for CO-{_short_id(order.id)}")

    if not audit_messages:
        audit_messages.append(f"Edited cutting order CO-{_short_id(order.id)}")

    for message in audit_messages:
        await write_audit(
            db,
            company_id=company_id,
            user_id=user_id,
            resource_type=_RESOURCE,
            resource_id=order.id,
            message=message,
        )

    await db.commit()
    return await get_cutting_order(db, company_id=company_id, order_id=order.id)


# ----------------------------------------------------------------------- delete


async def _assert_no_shipments(db: AsyncSession, *, order_id: uuid.UUID) -> None:
    count_stmt = select(func.count()).select_from(SewingShipment).where(SewingShipment.cutting_order_id == order_id)
    if int((await db.exec(count_stmt)).first() or 0) > 0:
        raise ConflictError(detail="Cannot delete cutting order — a sewing shipment references it")


async def delete_cutting_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
) -> None:
    stmt = scoped(select(CuttingOrder), CuttingOrder, company_id).where(CuttingOrder.id == order_id)
    order = (await db.exec(stmt)).first()
    if order is None:
        raise NotFoundError(detail="Cutting order not found")

    await _assert_no_shipments(db, order_id=order.id)

    short = _short_id(order.id)
    await db.delete(order)
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=order.id,
        message=f"Deleted cutting order CO-{short}",
    )
    await db.commit()


__all__ = [
    "create_cutting_order",
    "delete_cutting_order",
    "get_cutting_cost",
    "get_cutting_order",
    "list_cutting_orders",
    "update_cutting_order",
]
