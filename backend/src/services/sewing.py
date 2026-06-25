"""Sewing-shipment service.

Service surface
---------------
- `list_shipments` / `get_shipment` — return `ShipmentRead` shaped DTOs,
  pre-joined with contractor + cutting order + items.
- `create_shipment` — **T2**: persists the parent + child items, drawing down
  cut-piece availability. Requires the cutting order to be DONE and each
  requested quantity ≤ available cut pieces for that size. All received +
  credited quantities start at zero; status starts as `sent`.
- `receive_shipment` — **T3**: re-receivable, delta-only. Credits **blank
  pieces** (`BlankPieceMovement(entry)` with `sewing_shipment_id` provenance)
  for the newly-received delta per line (`received - credited`), resolving /
  creating the blank piece by the cutting order's spec+size+color/color_code,
  then advances the per-line `credited_quantity` watermark. No finished
  `StockEntry` is written. Status is derived (`received` / `partial`).
- `cancel_shipment` — flips status to `cancelled`. Rejects if the shipment
  is already received/partial/cancelled.

Blank crediting (T3)
--------------------
The cutting order carries `spec_id` + `color` + `color_code`. The shipment item
carries `size`. The blank piece is keyed by `(spec_id, size, color_code)` — a
real FK, not a free-text product/color heuristic. Crediting is delta-only and
idempotent across partial receives (clones the prototype's `receiveSewing`).
"""

import uuid
from collections.abc import Sequence

from sqlalchemy import String, cast, func
from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    BlankMovementKind,
    CuttingOrder,
    CuttingStatus,
    SewingContractor,
    SewingShipment,
    SewingShipmentItem,
    ShipmentStatus,
)
from schemas._common import PageParams
from schemas.sewing import (
    ShipmentContractorRead,
    ShipmentCreate,
    ShipmentCuttingOrderRead,
    ShipmentFilters,
    ShipmentItemRead,
    ShipmentRead,
    ShipmentReceiveBody,
)
from services import blank_stock as blank_stock_service
from services import cutting as cutting_service
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError

_RESOURCE = "sewing_shipments"


def _cutting_code(cutting_order_id: uuid.UUID) -> str:
    """Short display code derived from the cutting order id.

    Cutting orders don't have a human code column yet — we use the first
    eight hex digits of their UUID so the API surface is stable without
    requiring a schema change.
    """

    return f"OC-{cutting_order_id.hex[:8].upper()}"


def _to_read(
    shipment: SewingShipment,
    *,
    contractor: SewingContractor,
    cutting_order: CuttingOrder | None,
    items: Sequence[SewingShipmentItem],
) -> ShipmentRead:
    return ShipmentRead(
        id=shipment.id,
        cutting_order=(
            ShipmentCuttingOrderRead(id=cutting_order.id, code=_cutting_code(cutting_order.id))
            if cutting_order is not None
            else None
        ),
        contractor=ShipmentContractorRead(id=contractor.id, name=contractor.name),
        status=shipment.status,
        sent_at=shipment.sent_at,
        received_at=shipment.received_at,
        items=[
            ShipmentItemRead(
                id=item.id,
                size=item.size,
                requested_quantity=item.requested_quantity,
                received_quantity=item.received_quantity,
                credited_quantity=item.credited_quantity,
            )
            for item in items
        ],
        created_at=shipment.created_at,
        updated_at=shipment.updated_at,
    )


async def _load_items(
    db: AsyncSession,
    shipment_id: uuid.UUID,
) -> list[SewingShipmentItem]:
    result = await db.exec(
        select(SewingShipmentItem)
        .where(SewingShipmentItem.shipment_id == shipment_id)
        .order_by(SewingShipmentItem.size)  # type: ignore[attr-defined]
    )
    return list(result.all())


async def _load_contractor(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    contractor_id: uuid.UUID,
) -> SewingContractor:
    stmt = scoped(select(SewingContractor), SewingContractor, company_id).where(SewingContractor.id == contractor_id)
    result = await db.exec(stmt)
    contractor = result.first()
    if contractor is None:
        raise NotFoundError(detail="Contractor not found")
    return contractor


async def _load_cutting_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    cutting_order_id: uuid.UUID,
) -> CuttingOrder:
    stmt = scoped(select(CuttingOrder), CuttingOrder, company_id).where(CuttingOrder.id == cutting_order_id)
    result = await db.exec(stmt)
    cutting_order = result.first()
    if cutting_order is None:
        raise NotFoundError(detail="Cutting order not found")
    return cutting_order


async def list_shipments(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: ShipmentFilters,
    page: PageParams,
) -> tuple[list[ShipmentRead], int]:
    """List shipments for a tenant.

    Joins on contractor + cutting_order so the search filter can match
    against contractor name without an extra round-trip.
    """

    base = (
        scoped(select(SewingShipment), SewingShipment, company_id)
        .join(SewingContractor, SewingContractor.id == SewingShipment.contractor_id)  # type: ignore[arg-type]
        # Outer join: legacy standalone remessas have no cutting order and must
        # still appear in the list (and the cutting-id search just won't match).
        .join(CuttingOrder, CuttingOrder.id == SewingShipment.cutting_order_id, isouter=True)  # type: ignore[arg-type]
    )

    if filters.status is not None:
        base = base.where(SewingShipment.status == filters.status)
    if filters.contractor_id is not None:
        base = base.where(SewingShipment.contractor_id == filters.contractor_id)
    if filters.cutting_order_id is not None:
        base = base.where(SewingShipment.cutting_order_id == filters.cutting_order_id)
    if filters.q:
        like = f"%{filters.q.strip()}%"
        base = base.where(
            or_(
                SewingContractor.name.ilike(like),  # type: ignore[attr-defined]
                # Match against the cutting-order id (cast to text) so the same
                # search box that finds a raw uuid substring still resolves.
                cast(CuttingOrder.id, String).ilike(like),
            )
        )

    total_result = await db.exec(select(func.count()).select_from(base.subquery()))
    total = int(total_result.one() or 0)

    items_stmt = (
        base.order_by(SewingShipment.created_at.desc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    items_result = await db.exec(items_stmt)
    shipments = list(items_result.all())
    if not shipments:
        return [], total

    contractor_ids = {s.contractor_id for s in shipments}
    cutting_ids = {s.cutting_order_id for s in shipments if s.cutting_order_id is not None}
    shipment_ids = [s.id for s in shipments]

    contractors = {
        c.id: c
        for c in (
            await db.exec(
                scoped(select(SewingContractor), SewingContractor, company_id).where(
                    SewingContractor.id.in_(contractor_ids)  # type: ignore[attr-defined]
                )
            )
        ).all()
    }
    cutting_orders = {
        co.id: co
        for co in (
            await db.exec(
                scoped(select(CuttingOrder), CuttingOrder, company_id).where(
                    CuttingOrder.id.in_(cutting_ids)  # type: ignore[attr-defined]
                )
            )
        ).all()
    }
    items_by_shipment: dict[uuid.UUID, list[SewingShipmentItem]] = {sid: [] for sid in shipment_ids}
    items_result = await db.exec(
        select(SewingShipmentItem)
        .where(SewingShipmentItem.shipment_id.in_(shipment_ids))  # type: ignore[attr-defined]
        .order_by(SewingShipmentItem.size)  # type: ignore[attr-defined]
    )
    for item in items_result.all():
        items_by_shipment[item.shipment_id].append(item)

    reads = [
        _to_read(
            s,
            contractor=contractors[s.contractor_id],
            cutting_order=cutting_orders.get(s.cutting_order_id) if s.cutting_order_id else None,
            items=items_by_shipment.get(s.id, []),
        )
        for s in shipments
    ]
    return reads, total


async def get_shipment(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    shipment_id: uuid.UUID,
) -> ShipmentRead:
    stmt = scoped(select(SewingShipment), SewingShipment, company_id).where(SewingShipment.id == shipment_id)
    shipment = (await db.exec(stmt)).first()
    if shipment is None:
        raise NotFoundError(detail="Shipment not found")

    contractor = await _load_contractor(
        db,
        company_id=company_id,
        contractor_id=shipment.contractor_id,
    )
    cutting_order = (
        await _load_cutting_order(db, company_id=company_id, cutting_order_id=shipment.cutting_order_id)
        if shipment.cutting_order_id is not None
        else None
    )
    items = await _load_items(db, shipment.id)
    return _to_read(
        shipment,
        contractor=contractor,
        cutting_order=cutting_order,
        items=items,
    )


async def create_shipment(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: ShipmentCreate,
) -> ShipmentRead:
    """T2: create a shipment in `sent` status, drawing down cut-piece availability.

    Requires the cutting order to be DONE and each requested quantity ≤ the
    available cut pieces for that size (availability excludes cancelled
    shipments; this shipment's own rows are not yet persisted at validation
    time). Items persist with received + credited quantities at zero.
    """

    # Validate references first — both must belong to the calling tenant.
    contractor = await _load_contractor(
        db,
        company_id=company_id,
        contractor_id=payload.contractor_id,
    )
    cutting_order = await _load_cutting_order(
        db,
        company_id=company_id,
        cutting_order_id=payload.cutting_order_id,
    )

    if cutting_order.status != CuttingStatus.DONE:
        raise ConflictError(detail="Cutting order must be DONE to create a shipment")

    available = await cutting_service.available_by_size(
        db,
        company_id=company_id,
        cutting_order_id=cutting_order.id,
    )
    for item in payload.items:
        avail = available.get(item.size, 0)
        if item.requested_quantity > avail:
            raise ConflictError(
                detail=(
                    f"Requested {item.requested_quantity} for size {item.size.value} "
                    f"exceeds available cut pieces ({avail})"
                ),
            )

    shipment = SewingShipment(
        company_id=company_id,
        cutting_order_id=payload.cutting_order_id,
        contractor_id=payload.contractor_id,
        sent_at=payload.sent_at,
        received_at=None,
        status=ShipmentStatus.SENT,
    )
    db.add(shipment)
    await db.flush()

    items = [
        SewingShipmentItem(
            shipment_id=shipment.id,
            size=item.size,
            requested_quantity=item.requested_quantity,
            received_quantity=0,
            credited_quantity=0,
        )
        for item in payload.items
    ]
    db.add_all(items)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=shipment.id,
        message=f"Shipment created to {contractor.name}",
    )
    await db.commit()
    await db.refresh(shipment)
    return _to_read(
        shipment,
        contractor=contractor,
        cutting_order=cutting_order,
        items=await _load_items(db, shipment.id),
    )


async def receive_shipment(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    shipment_id: uuid.UUID,
    payload: ShipmentReceiveBody,
) -> ShipmentRead:
    """T3: apply a (possibly partial, re-receivable) receive to a shipment.

    Allowed when status is `sent` or `partial`. For each payload line: set the
    item's `received_quantity` (reject over-delivery), compute the delta
    `received - credited`, credit that delta to the resolved/created blank piece
    via `blank_stock.record_movement` (with `sewing_shipment_id` provenance),
    then advance `credited_quantity = received_quantity`. Sizes omitted from the
    payload retain their current `received_quantity` (a re-receive only updates
    provided sizes). No finished `StockEntry` is written. One transaction.
    """

    stmt = scoped(select(SewingShipment), SewingShipment, company_id).where(SewingShipment.id == shipment_id)
    shipment = (await db.exec(stmt)).first()
    if shipment is None:
        raise NotFoundError(detail="Shipment not found")

    if shipment.status not in (ShipmentStatus.SENT, ShipmentStatus.PARTIAL):
        raise ConflictError(detail="Shipment cannot be received in its current state")

    # A standalone (legacy-imported) shipment has no cutting order, so there is
    # no spec/color to credit blank stock against — it can't be received.
    if shipment.cutting_order_id is None:
        raise ConflictError(detail="Shipment has no linked cutting order and cannot be received")

    items = await _load_items(db, shipment.id)
    items_by_size = {item.size: item for item in items}

    # 1) Resolve + validate payload lines (over-delivery, unknown size).
    received_updates: dict = {}
    for receive_item in payload.items:
        target = items_by_size.get(receive_item.size)
        if target is None:
            raise ConflictError(
                detail=f"Shipment has no item for size {receive_item.size.value}",
            )
        if receive_item.received_quantity > target.requested_quantity:
            raise ConflictError(
                detail=(
                    f"Received quantity ({receive_item.received_quantity}) "
                    f"exceeds requested ({target.requested_quantity}) for "
                    f"size {receive_item.size.value}"
                ),
            )
        received_updates[receive_item.size] = receive_item.received_quantity

    cutting_order = await _load_cutting_order(
        db,
        company_id=company_id,
        cutting_order_id=shipment.cutting_order_id,
    )
    contractor = await _load_contractor(
        db,
        company_id=company_id,
        contractor_id=shipment.contractor_id,
    )

    # 2) Apply received values for provided sizes; compute + credit deltas.
    total_delta = 0
    for item in items:
        if item.size not in received_updates:
            # Omitted sizes keep their current received_quantity (re-receive tops up).
            continue
        item.received_quantity = received_updates[item.size]
        delta = item.received_quantity - item.credited_quantity
        if delta < 0:
            raise ConflictError(
                detail=(f"Cannot reduce received below already-credited quantity for size {item.size.value}"),
            )
        if delta > 0:
            blank = await blank_stock_service.get_or_create_blank_piece(
                db,
                company_id=company_id,
                spec_id=cutting_order.spec_id,
                size=item.size,
                color=cutting_order.color,
                color_code=cutting_order.color_code,
            )
            await blank_stock_service.record_movement(
                db,
                company_id=company_id,
                blank_piece_id=blank.id,
                kind=BlankMovementKind.ENTRY,
                quantity=delta,
                sewing_shipment_id=shipment.id,
                notes=f"Remessa {_cutting_code(cutting_order.id)}",
            )
            item.credited_quantity = item.received_quantity
            total_delta += delta
        db.add(item)

    # 3) Derive status from the current per-line totals.
    total_received = sum(item.received_quantity for item in items)
    total_requested = sum(item.requested_quantity for item in items)
    fully_satisfied = all(item.received_quantity == item.requested_quantity for item in items)
    if fully_satisfied:
        shipment.status = ShipmentStatus.RECEIVED
    elif total_received > 0:
        shipment.status = ShipmentStatus.PARTIAL
    else:
        shipment.status = ShipmentStatus.SENT

    shipment.received_at = payload.received_at
    db.add(shipment)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=shipment.id,
        message=(
            f"Received shipment {_cutting_code(shipment.cutting_order_id)}: "
            f"+{total_delta} blank pieces ({total_received}/{total_requested})"
        ),
    )
    await db.commit()
    await db.refresh(shipment)
    return _to_read(
        shipment,
        contractor=contractor,
        cutting_order=cutting_order,
        items=await _load_items(db, shipment.id),
    )


async def cancel_shipment(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    shipment_id: uuid.UUID,
) -> ShipmentRead:
    stmt = scoped(select(SewingShipment), SewingShipment, company_id).where(SewingShipment.id == shipment_id)
    shipment = (await db.exec(stmt)).first()
    if shipment is None:
        raise NotFoundError(detail="Shipment not found")

    if shipment.status != ShipmentStatus.SENT:
        raise ConflictError(detail="Only 'sent' shipments can be cancelled")

    shipment.status = ShipmentStatus.CANCELLED
    db.add(shipment)
    await db.flush()

    contractor = await _load_contractor(
        db,
        company_id=company_id,
        contractor_id=shipment.contractor_id,
    )
    cutting_order = await _load_cutting_order(
        db,
        company_id=company_id,
        cutting_order_id=shipment.cutting_order_id,
    )

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=shipment.id,
        message=f"Shipment cancelled (was for {contractor.name})",
    )
    await db.commit()
    await db.refresh(shipment)
    return _to_read(
        shipment,
        contractor=contractor,
        cutting_order=cutting_order,
        items=await _load_items(db, shipment.id),
    )
