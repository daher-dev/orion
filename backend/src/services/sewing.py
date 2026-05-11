"""Sewing-shipment service.

Service surface
---------------
- `list_shipments` / `get_shipment` — return `ShipmentRead` shaped DTOs,
  pre-joined with contractor + cutting order + items.
- `create_shipment` — persists the parent + child items. All received
  quantities start at zero; status starts as `sent`.
- `receive_shipment` — sets received_at, distributes received quantities
  per size, derives status (`received` / `partial`), and creates a
  `StockEntry` row per non-zero size. Rejects over-delivery and double
  receive.
- `cancel_shipment` — flips status to `cancelled`. Rejects if the shipment
  is already received/partial/cancelled.

Stock crediting heuristic
-------------------------
The cutting order knows its `product_id`. A `ProductVariation` is keyed
by `(product_id, size, color_code)`. The shipment item has only `size`,
so we pick the FIRST variation that matches `product_id + size`. That
limitation is documented in F-009 — multi-color cutting orders need a
shipment-item color field which is out of scope.
"""

import uuid
from collections.abc import Sequence

from sqlalchemy import String, cast, func
from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    CuttingOrder,
    ProductVariation,
    SewingContractor,
    SewingShipment,
    SewingShipmentItem,
    ShipmentStatus,
    StockEntry,
    StockSource,
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
    cutting_order: CuttingOrder,
    items: Sequence[SewingShipmentItem],
) -> ShipmentRead:
    return ShipmentRead(
        id=shipment.id,
        cutting_order=ShipmentCuttingOrderRead(
            id=cutting_order.id,
            code=_cutting_code(cutting_order.id),
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
        .join(CuttingOrder, CuttingOrder.id == SewingShipment.cutting_order_id)  # type: ignore[arg-type]
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
    cutting_ids = {s.cutting_order_id for s in shipments}
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
            cutting_order=cutting_orders[s.cutting_order_id],
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
    cutting_order = await _load_cutting_order(
        db,
        company_id=company_id,
        cutting_order_id=shipment.cutting_order_id,
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
    """Create a new shipment in `sent` status with zero received quantities."""

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
    """Apply a receive payload to a `sent` shipment.

    Side effects:
    - sets `received_at` and the per-size `received_quantity`;
    - computes status (`received` if every item matches its requested,
      `partial` otherwise);
    - creates a `StockEntry` row per size with non-zero received quantity.
    """

    stmt = scoped(select(SewingShipment), SewingShipment, company_id).where(SewingShipment.id == shipment_id)
    shipment = (await db.exec(stmt)).first()
    if shipment is None:
        raise NotFoundError(detail="Shipment not found")

    if shipment.status != ShipmentStatus.SENT:
        raise ConflictError(detail="Shipment is not in 'sent' state")

    items = await _load_items(db, shipment.id)
    items_by_size = {item.size: item for item in items}

    received_by_size: dict = {}
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
        received_by_size[receive_item.size] = receive_item.received_quantity

    # Apply the received values. Sizes not in the payload default to zero
    # received (treated as fully missing — status will be `partial`).
    total_received = 0
    total_requested = 0
    fully_satisfied = True
    for item in items:
        rcv = received_by_size.get(item.size, 0)
        item.received_quantity = rcv
        total_received += rcv
        total_requested += item.requested_quantity
        if rcv != item.requested_quantity:
            fully_satisfied = False
        db.add(item)

    shipment.received_at = payload.received_at
    shipment.status = ShipmentStatus.RECEIVED if fully_satisfied else ShipmentStatus.PARTIAL

    # Look up variations for the cutting order's product so we can credit
    # stock per (size). We pick the FIRST variation per size when multiple
    # colors exist (documented limitation).
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

    variations_result = await db.exec(
        scoped(select(ProductVariation), ProductVariation, company_id)
        .where(ProductVariation.product_id == cutting_order.product_id)
        .order_by(ProductVariation.created_at.asc())  # type: ignore[attr-defined]
    )
    variation_by_size: dict = {}
    for v in variations_result.all():
        variation_by_size.setdefault(v.size, v)

    for item in items:
        if item.received_quantity <= 0:
            continue
        variation = variation_by_size.get(item.size)
        if variation is None:
            raise ConflictError(
                detail=(f"No product variation exists for size {item.size.value} — cannot credit stock"),
            )
        db.add(
            StockEntry(
                company_id=company_id,
                variation_id=variation.id,
                shipment_id=shipment.id,
                quantity=item.received_quantity,
                source=StockSource.SHIPMENT,
                notes=None,
            )
        )

    db.add(shipment)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=shipment.id,
        message=(f"Received shipment {_cutting_code(shipment.cutting_order_id)} ({total_received} pieces)"),
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
