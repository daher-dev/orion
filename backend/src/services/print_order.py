"""Service layer for the Print Orders (Impressão) feature — T4.

Convention notes
----------------
- Every SELECT is :func:`scoped` to the active tenant; ``company_id`` is set
  explicitly on every insert.
- A ``PrintOrder`` is keyed by a transfer-based ``PrintDesign`` (silkscreen is
  rejected on create — it is not transfer-based) plus an optional paper/film
  roll. Mirrors ``services.cutting``: one row per ``(order, variation, side)``
  in ``PrintOrderOutput``, replaced atomically on a PATCH that carries
  ``printed_outputs``.
- The status machine (pending → printing → done) is the same shape as cutting's
  ``_TRANSITIONS``. Moving status to ``done`` via PATCH does **not** post stock —
  ``complete`` ("Lançar impressos") is the posting action. This decoupling lets
  the operator record printed counts then explicitly launch.
- **T4 (complete)**: ONE transaction. Debits the attached paper roll's meters
  (clamp at 0, EXIT movement with print-order provenance) and credits printed
  transfers (design + side, summed across variations; ENTRY movement with
  print-order provenance), then sets ``printed_at`` / ``meters_consumed`` /
  ``status=done``. Idempotent: guarded on ``printed_at IS NOT NULL`` (a re-call
  is a silent no-op — no double-credit), mirroring the prototype's ``posted``
  guard and ``sewing.receive_shipment``'s credited watermark.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import String, cast, func, or_
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    PaperRoll,
    PaperType,
    PrintDesign,
    PrintDesignVariation,
    PrintedMovementKind,
    PrintOrder,
    PrintOrderOutput,
    PrintOrderStatus,
    PrintSide,
    PrintTechnique,
)
from schemas._common import PageParams
from schemas.print_order import (
    PaperRollRef,
    PrintDesignRef,
    PrintOrderComplete,
    PrintOrderCreate,
    PrintOrderFilters,
    PrintOrderOutputRead,
    PrintOrderRead,
    PrintOrderUpdate,
    PrintVariationRef,
)
from services import paper_roll as paper_roll_service
from services import printed_transfer as printed_transfer_service
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError, ValidationError

_RESOURCE = "print_orders"

_METERS = Decimal("0.01")

# Meters of paper/film consumed per printed piece, by technique. Silkscreen is
# rejected on create (not transfer-based) so its rate is never hit; the default
# is a safety value only.
_RATE: dict[PrintTechnique, Decimal] = {
    PrintTechnique.DTF: Decimal("0.35"),
    PrintTechnique.SUBLIMATION: Decimal("0.5"),
}
_DEFAULT_RATE = Decimal("0.4")


def rate_for(technique: PrintTechnique) -> Decimal:
    return _RATE.get(technique, _DEFAULT_RATE)


# Paper types compatible with each technique.
_COMPATIBLE_PAPER: dict[PrintTechnique, set[PaperType]] = {
    PrintTechnique.DTF: {PaperType.DTF_FILM},
    PrintTechnique.SUBLIMATION: {PaperType.SUBLIMATION_PAPER, PaperType.TRANSFER_PAPER},
}


# ---------------------------------------------------------------------- helpers


def _short_id(value: uuid.UUID) -> str:
    return value.hex[:8].upper()


def _code(order_id: uuid.UUID) -> str:
    return f"IM-{order_id.hex[:8].upper()}"


def _paper_code(roll_id: uuid.UUID) -> str:
    return f"BP-{roll_id.hex[:6].upper()}"


def _to_read(
    order: PrintOrder,
    *,
    design: PrintDesign,
    paper_roll: PaperRoll | None,
    outputs: list[PrintOrderOutput],
    variations: dict[uuid.UUID, PrintDesignVariation],
) -> PrintOrderRead:
    rate = rate_for(design.technique)
    total_planned = sum(o.planned_quantity for o in outputs)
    total_printed = sum(o.printed_quantity for o in outputs)
    estimated = (rate * Decimal(total_printed)).quantize(_METERS)

    output_reads: list[PrintOrderOutputRead] = []
    for o in sorted(outputs, key=lambda r: (r.side.value, str(r.print_design_variation_id))):
        variation = variations.get(o.print_design_variation_id)
        output_reads.append(
            PrintOrderOutputRead(
                print_design_variation_id=o.print_design_variation_id,
                variation=PrintVariationRef(
                    id=o.print_design_variation_id,
                    name=variation.name if variation else "",
                    ink_hex=variation.ink_hex if variation else "#000000",
                ),
                side=o.side,
                planned_quantity=o.planned_quantity,
                printed_quantity=o.printed_quantity,
            )
        )

    return PrintOrderRead(
        id=order.id,
        code=_code(order.id),
        design=PrintDesignRef(
            id=design.id,
            code=design.code,
            name=design.name,
            technique=design.technique,
            image_url=design.image_url,
        ),
        paper_roll=(
            PaperRollRef(id=paper_roll.id, code=_paper_code(paper_roll.id), paper_type=paper_roll.paper_type.value)
            if paper_roll is not None
            else None
        ),
        status=order.status,
        technique=design.technique,
        rate_m_per_piece=float(rate),
        total_planned=total_planned,
        total_printed=total_printed,
        estimated_meters=float(estimated),
        meters_consumed=order.meters_consumed,
        printed_at=order.printed_at,
        outputs=output_reads,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


async def _outputs_for(db: AsyncSession, order_id: uuid.UUID) -> list[PrintOrderOutput]:
    stmt = (
        select(PrintOrderOutput)
        .where(PrintOrderOutput.print_order_id == order_id)
        .order_by(PrintOrderOutput.side, PrintOrderOutput.created_at)  # type: ignore[arg-type]
    )
    return list((await db.exec(stmt)).all())


async def _variations_map(
    db: AsyncSession, *, company_id: uuid.UUID, variation_ids: set[uuid.UUID]
) -> dict[uuid.UUID, PrintDesignVariation]:
    if not variation_ids:
        return {}
    stmt = scoped(select(PrintDesignVariation), PrintDesignVariation, company_id).where(
        PrintDesignVariation.id.in_(variation_ids)  # type: ignore[attr-defined]
    )
    return {v.id: v for v in (await db.exec(stmt)).all()}


async def _load_design(db: AsyncSession, *, company_id: uuid.UUID, design_id: uuid.UUID) -> PrintDesign:
    stmt = scoped(select(PrintDesign), PrintDesign, company_id).where(PrintDesign.id == design_id)
    design = (await db.exec(stmt)).first()
    if design is None:  # pragma: no cover — FK-guarded for loads off a persisted order
        raise NotFoundError(detail="Print order references a missing print design")
    return design


async def _load_paper_roll(db: AsyncSession, *, company_id: uuid.UUID, roll_id: uuid.UUID | None) -> PaperRoll | None:
    if roll_id is None:
        return None
    stmt = scoped(select(PaperRoll), PaperRoll, company_id).where(PaperRoll.id == roll_id)
    return (await db.exec(stmt)).first()


async def _load_for_read(db: AsyncSession, *, company_id: uuid.UUID, order: PrintOrder) -> PrintOrderRead:
    design = await _load_design(db, company_id=company_id, design_id=order.print_design_id)
    paper_roll = await _load_paper_roll(db, company_id=company_id, roll_id=order.paper_roll_id)
    outputs = await _outputs_for(db, order.id)
    variations = await _variations_map(
        db, company_id=company_id, variation_ids={o.print_design_variation_id for o in outputs}
    )
    return _to_read(order, design=design, paper_roll=paper_roll, outputs=outputs, variations=variations)


# ---------------------------------------------------------------- validation


async def _validate_paper_compatibility(
    db: AsyncSession, *, company_id: uuid.UUID, roll_id: uuid.UUID, technique: PrintTechnique
) -> None:
    """Load the roll (422 if not in company) and assert paper_type ↔ technique."""

    stmt = scoped(select(PaperRoll), PaperRoll, company_id).where(PaperRoll.id == roll_id)
    roll = (await db.exec(stmt)).first()
    if roll is None:
        raise ValidationError(detail="Paper roll not found for this company")
    compatible = _COMPATIBLE_PAPER.get(technique, set())
    if roll.paper_type not in compatible:
        raise ValidationError(
            detail=f"Paper type {roll.paper_type.value} is incompatible with technique {technique.value}"
        )


async def _validate_outputs(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    design: PrintDesign,
    items: list,
) -> None:
    """Each variation must belong to ``design`` and the side must be enabled."""

    variation_ids = {item.print_design_variation_id for item in items}
    variations = await _variations_map(db, company_id=company_id, variation_ids=variation_ids)
    for item in items:
        variation = variations.get(item.print_design_variation_id)
        if variation is None or variation.print_design_id != design.id:
            raise ValidationError(detail="Print design variation does not belong to this design")
        if item.side == PrintSide.FRONT and not design.has_front:
            raise ValidationError(detail="Design does not have a front side")
        if item.side == PrintSide.BACK and not design.has_back:
            raise ValidationError(detail="Design does not have a back side")


# ---------------------------------------------------------------------- queries


def _apply_filters(stmt, filters: PrintOrderFilters):
    if filters.q:
        like = f"%{filters.q.strip().lower()}%"
        stmt = stmt.join(PrintDesign, PrintDesign.id == PrintOrder.print_design_id).where(
            or_(
                func.lower(PrintDesign.code).like(like),
                func.lower(PrintDesign.name).like(like),
                func.lower(cast(PrintOrder.id, String)).like(like),
            )
        )
    if filters.status is not None:
        stmt = stmt.where(PrintOrder.status == filters.status)
    if filters.print_design_id is not None:
        stmt = stmt.where(PrintOrder.print_design_id == filters.print_design_id)
    return stmt


async def list_print_orders(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: PrintOrderFilters,
    page: PageParams,
) -> tuple[list[PrintOrderRead], int]:
    base = scoped(select(PrintOrder), PrintOrder, company_id)
    filtered = _apply_filters(base, filters)

    count_stmt = _apply_filters(scoped(select(func.count()).select_from(PrintOrder), PrintOrder, company_id), filters)
    total = int((await db.exec(count_stmt)).one() or 0)

    items_stmt = (
        filtered.order_by(PrintOrder.created_at.desc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    orders = list((await db.exec(items_stmt)).all())
    if not orders:
        return [], total

    design_ids = {o.print_design_id for o in orders}
    roll_ids = {o.paper_roll_id for o in orders if o.paper_roll_id is not None}
    order_ids = [o.id for o in orders]

    designs = {
        d.id: d
        for d in (
            await db.exec(scoped(select(PrintDesign), PrintDesign, company_id).where(PrintDesign.id.in_(design_ids)))  # type: ignore[attr-defined]
        ).all()
    }
    rolls = {
        r.id: r
        for r in (
            await db.exec(scoped(select(PaperRoll), PaperRoll, company_id).where(PaperRoll.id.in_(roll_ids)))  # type: ignore[attr-defined]
        ).all()
    }

    outputs_by_order: dict[uuid.UUID, list[PrintOrderOutput]] = {}
    outputs_stmt = (
        select(PrintOrderOutput)
        .where(PrintOrderOutput.print_order_id.in_(order_ids))  # type: ignore[attr-defined]
        .order_by(PrintOrderOutput.side, PrintOrderOutput.created_at)  # type: ignore[arg-type]
    )
    all_outputs = list((await db.exec(outputs_stmt)).all())
    for row in all_outputs:
        outputs_by_order.setdefault(row.print_order_id, []).append(row)
    variations = await _variations_map(
        db, company_id=company_id, variation_ids={o.print_design_variation_id for o in all_outputs}
    )

    return (
        [
            _to_read(
                order,
                design=designs[order.print_design_id],
                paper_roll=rolls.get(order.paper_roll_id) if order.paper_roll_id else None,
                outputs=outputs_by_order.get(order.id, []),
                variations=variations,
            )
            for order in orders
        ],
        total,
    )


async def get_print_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    order_id: uuid.UUID,
) -> PrintOrderRead:
    stmt = scoped(select(PrintOrder), PrintOrder, company_id).where(PrintOrder.id == order_id)
    order = (await db.exec(stmt)).first()
    if order is None:
        raise NotFoundError(detail="Print order not found")
    return await _load_for_read(db, company_id=company_id, order=order)


# ----------------------------------------------------------------------- create


async def create_print_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: PrintOrderCreate,
) -> PrintOrderRead:
    design = await _load_design(db, company_id=company_id, design_id=payload.print_design_id)
    if design is None:  # pragma: no cover — _load_design raises NotFound already
        raise NotFoundError(detail="Print design not found")

    if design.technique == PrintTechnique.SILKSCREEN:
        raise ValidationError(detail="Silkscreen designs are not transfer-based and cannot have print orders")

    if payload.paper_roll_id is not None:
        await _validate_paper_compatibility(
            db, company_id=company_id, roll_id=payload.paper_roll_id, technique=design.technique
        )

    await _validate_outputs(db, company_id=company_id, design=design, items=payload.planned_outputs)

    order = PrintOrder(
        company_id=company_id,
        print_design_id=payload.print_design_id,
        paper_roll_id=payload.paper_roll_id,
        status=PrintOrderStatus.PENDING,
        printed_at=None,
        meters_consumed=None,
    )
    db.add(order)
    await db.flush()

    for item in payload.planned_outputs:
        db.add(
            PrintOrderOutput(
                print_order_id=order.id,
                print_design_variation_id=item.print_design_variation_id,
                side=item.side,
                planned_quantity=item.planned_quantity,
                printed_quantity=0,
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
        message=f"Created print order {_code(order.id)}",
    )
    await db.commit()
    return await get_print_order(db, company_id=company_id, order_id=order.id)


# ----------------------------------------------------------------------- update


_TRANSITIONS: dict[PrintOrderStatus, set[PrintOrderStatus]] = {
    PrintOrderStatus.PENDING: {PrintOrderStatus.PRINTING, PrintOrderStatus.DONE},
    PrintOrderStatus.PRINTING: {PrintOrderStatus.PENDING, PrintOrderStatus.DONE},
    PrintOrderStatus.DONE: {PrintOrderStatus.PRINTING},
}


def _assert_valid_transition(current: PrintOrderStatus, target: PrintOrderStatus) -> None:
    if current == target:
        return
    if target not in _TRANSITIONS.get(current, set()):
        raise ConflictError(detail=f"Cannot transition print order status from {current.value} to {target.value}")


async def update_print_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
    payload: PrintOrderUpdate,
) -> PrintOrderRead:
    stmt = scoped(select(PrintOrder), PrintOrder, company_id).where(PrintOrder.id == order_id)
    order = (await db.exec(stmt)).first()
    if order is None:
        raise NotFoundError(detail="Print order not found")

    design = await _load_design(db, company_id=company_id, design_id=order.print_design_id)
    data = payload.model_dump(exclude_unset=True)
    audit_messages: list[str] = []

    if "status" in data and data["status"] is not None:
        target = PrintOrderStatus(data["status"])
        _assert_valid_transition(order.status, target)
        if target != order.status:
            audit_messages.append(f"Marked print order {_code(order.id)} as {target.value.upper()}")
            order.status = target

    if "paper_roll_id" in data:
        new_roll_id = data["paper_roll_id"]
        if new_roll_id is not None:
            await _validate_paper_compatibility(
                db, company_id=company_id, roll_id=new_roll_id, technique=design.technique
            )
        order.paper_roll_id = new_roll_id

    if "printed_outputs" in data and data["printed_outputs"] is not None:
        items = payload.printed_outputs or []
        await _validate_outputs(db, company_id=company_id, design=design, items=items)
        await db.exec(
            delete(PrintOrderOutput).where(PrintOrderOutput.print_order_id == order.id)  # type: ignore[arg-type]
        )
        await db.flush()
        for item in items:
            # ``printed_quantity`` doubles as the new ``planned_quantity`` for the
            # replaced row set (the check constraint enforces printed ≤ planned).
            db.add(
                PrintOrderOutput(
                    print_order_id=order.id,
                    print_design_variation_id=item.print_design_variation_id,
                    side=item.side,
                    planned_quantity=item.printed_quantity,
                    printed_quantity=item.printed_quantity,
                )
            )
        await db.flush()
        audit_messages.append(f"Recorded printed outputs for {_code(order.id)}")

    db.add(order)
    await db.flush()

    if not audit_messages:
        audit_messages.append(f"Edited print order {_code(order.id)}")
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
    return await get_print_order(db, company_id=company_id, order_id=order.id)


# --------------------------------------------------------------------- complete


async def complete_print_order(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    order_id: uuid.UUID,
    payload: PrintOrderComplete,
) -> PrintOrderRead:
    """T4: post the printed run in ONE transaction. Idempotent.

    Debits the attached paper roll's meters (clamp at 0, EXIT movement with
    print-order provenance) and credits printed transfers per side summed across
    variations (ENTRY movement with print-order provenance), then sets the
    completion watermark. A re-call after ``printed_at`` is set is a silent
    no-op returning the current read (no double-credit).
    """

    stmt = scoped(select(PrintOrder), PrintOrder, company_id).where(PrintOrder.id == order_id)
    order = (await db.exec(stmt)).first()
    if order is None:
        raise NotFoundError(detail="Print order not found")

    # IDEMPOTENCY GUARD: completion is one-way for stock (mirror cutting's fabric
    # debit + sewing's credited watermark). A re-call returns the current read.
    if order.printed_at is not None:
        return await _load_for_read(db, company_id=company_id, order=order)

    design = await _load_design(db, company_id=company_id, design_id=order.print_design_id)
    outputs = await _outputs_for(db, order.id)
    total_printed = sum(o.printed_quantity for o in outputs)
    short = _short_id(order.id)

    rate = rate_for(design.technique)
    meters = (
        payload.meters_consumed
        if payload.meters_consumed is not None
        else (rate * Decimal(total_printed)).quantize(_METERS)
    )

    # (A) DEBIT PAPER — metered, clamp at 0, EXIT with print-order provenance.
    if order.paper_roll_id is not None and meters > 0:
        roll = await _load_paper_roll(db, company_id=company_id, roll_id=order.paper_roll_id)
        if roll is not None:
            await paper_roll_service.consume_for_print_order(
                db,
                company_id=company_id,
                roll=roll,
                quantity=meters,
                print_order_id=order.id,
                notes=f"Impressão {_code(order.id)}",
            )

    # (B) CREDIT PRINTED TRANSFERS — per side, summed across variations.
    per_side: dict[PrintSide, int] = defaultdict(int)
    for o in outputs:
        per_side[o.side] += o.printed_quantity
    for side, qty in per_side.items():
        if qty <= 0:
            continue
        transfer = await printed_transfer_service.get_or_create_printed_transfer(
            db, company_id=company_id, print_design_id=order.print_design_id, side=side
        )
        await printed_transfer_service.record_movement(
            db,
            company_id=company_id,
            printed_transfer_id=transfer.id,
            kind=PrintedMovementKind.ENTRY,
            quantity=qty,
            print_order_id=order.id,
            notes=f"Impressão {_code(order.id)}",
        )

    # (C) FINALIZE order.
    order.meters_consumed = meters
    order.printed_at = datetime.now(UTC)
    if order.status != PrintOrderStatus.DONE:
        order.status = PrintOrderStatus.DONE
    db.add(order)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=order.id,
        message=f"Completed print order {_code(order.id)}: +{total_printed} printed, -{meters} m paper (IM-{short})",
    )
    await db.commit()
    return await get_print_order(db, company_id=company_id, order_id=order.id)


__all__ = [
    "complete_print_order",
    "create_print_order",
    "get_print_order",
    "list_print_orders",
    "rate_for",
    "update_print_order",
]
