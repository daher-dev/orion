"""Service layer for the Assembly (Montagem) feature — T5.

Convention notes
----------------
- Every SELECT is :func:`scoped` to the active tenant; ``company_id`` is set
  explicitly on every insert.
- Assembly is an *action*, not a kanban entity. ``assemble`` runs ONE
  transaction (clones ``sewing.receive_shipment``'s atomicity): hard-guard the
  counted input tiers (blank + printed) on live on-hand (409 if insufficient —
  never clamp), resolve/create the finished ``Product`` + ``ProductVariation``
  from the blank's spec+color+size and the transfer's design via ``make_sku``,
  then write the ``AssemblyRun`` provenance row + the three ledger writes (blank
  -qty, printed -qty, finished ``StockEntry`` +qty), all carrying the run id.
- On-hand effects are live (no denormalised balances), so the resolved SKU is
  immediately order-ready in ``/stock`` and Separação.
- ``list_buildable`` is a computed discovery assist (no writes): every
  ``(printed_transfer, candidate blank)`` pair with positive on-hand, with
  ``max_buildable = min(blank.on_hand, printed_on_hand)``. Phase 4 is
  print-agnostic on the blank (a printed transfer is design-keyed; any blank can
  receive it) and intentionally does not filter by demand (Phase 5).
"""

from __future__ import annotations

import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    AssemblyRun,
    Batch,
    BlankMovementKind,
    BlankPiece,
    PrintDesign,
    PrintedMovementKind,
    PrintedTransfer,
    Product,
    ProductSpec,
    ProductType,
    ProductVariation,
    StockEntry,
    StockSource,
)
from schemas._common import PageParams
from schemas.assembly import (
    AssembleBody,
    AssemblyRunRead,
    AssemblyVariationRef,
    BuildableBlankRef,
    BuildableFilters,
    BuildableRow,
    BuildableSpecRef,
)
from schemas.print_order import PrintDesignRef
from services import blank_stock as blank_stock_service
from services import printed_transfer as printed_transfer_service
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError, ValidationError

_RESOURCE = "assembly_runs"

# Product.product_type is NOT NULL and ProductSpec carries no garment-type field,
# so a find-or-create Product must supply one. Deterministic default; revisit
# when the spec carries a garment type.
_DEFAULT_PRODUCT_TYPE = ProductType.CAMISETA


def _run_code(run_id: uuid.UUID) -> str:
    return f"MT-{run_id.hex[:8].upper()}"


# ---------------------------------------------------------------------- loaders


async def _load_blank(db: AsyncSession, *, company_id: uuid.UUID, blank_piece_id: uuid.UUID) -> BlankPiece:
    stmt = scoped(select(BlankPiece), BlankPiece, company_id).where(BlankPiece.id == blank_piece_id)
    blank = (await db.exec(stmt)).first()
    if blank is None:
        raise NotFoundError(detail="Blank piece not found")
    return blank


async def _load_transfer(db: AsyncSession, *, company_id: uuid.UUID, printed_transfer_id: uuid.UUID) -> PrintedTransfer:
    stmt = scoped(select(PrintedTransfer), PrintedTransfer, company_id).where(PrintedTransfer.id == printed_transfer_id)
    transfer = (await db.exec(stmt)).first()
    if transfer is None:
        raise NotFoundError(detail="Printed transfer not found")
    return transfer


async def _load_spec(db: AsyncSession, *, company_id: uuid.UUID, spec_id: uuid.UUID) -> ProductSpec:
    stmt = scoped(select(ProductSpec), ProductSpec, company_id).where(ProductSpec.id == spec_id)
    spec = (await db.exec(stmt)).first()
    if spec is None:  # pragma: no cover — FK-guarded off a persisted blank piece
        raise NotFoundError(detail="Blank piece references a missing product spec")
    return spec


async def _load_design(db: AsyncSession, *, company_id: uuid.UUID, design_id: uuid.UUID) -> PrintDesign:
    stmt = scoped(select(PrintDesign), PrintDesign, company_id).where(PrintDesign.id == design_id)
    design = (await db.exec(stmt)).first()
    if design is None:  # pragma: no cover — FK-guarded off a persisted transfer
        raise NotFoundError(detail="Printed transfer references a missing print design")
    return design


async def _assert_batch_in_company(db: AsyncSession, *, company_id: uuid.UUID, batch_id: uuid.UUID) -> None:
    stmt = scoped(select(Batch), Batch, company_id).where(Batch.id == batch_id)
    if (await db.exec(stmt)).first() is None:
        raise ValidationError(detail="Batch not found for this company")


# ----------------------------------------------------------------- assemble (T5)


async def assemble_internal(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: AssembleBody,
) -> AssemblyRunRead:
    """The T5 transition WITHOUT committing — the caller owns the transaction.

    Identical to :func:`assemble` minus the final ``db.commit()``. Used by the
    lote "montar" path (``batch.assemble_batch``) so several assembles land in a
    single transaction; the on-hand guards (409) still apply per call.
    """

    blank = await _load_blank(db, company_id=company_id, blank_piece_id=payload.blank_piece_id)
    transfer = await _load_transfer(db, company_id=company_id, printed_transfer_id=payload.printed_transfer_id)
    spec = await _load_spec(db, company_id=company_id, spec_id=blank.spec_id)
    design = await _load_design(db, company_id=company_id, design_id=transfer.print_design_id)
    if payload.batch_id is not None:
        await _assert_batch_in_company(db, company_id=company_id, batch_id=payload.batch_id)

    # (1) HARD ON-HAND GUARD — counted tiers reject with 409, never clamp.
    blank_on_hand = await blank_stock_service._compute_on_hand(db, company_id=company_id, blank_piece_id=blank.id)
    printed_on_hand = await printed_transfer_service._compute_on_hand(
        db, company_id=company_id, printed_transfer_id=transfer.id
    )
    if blank_on_hand < payload.quantity:
        raise ConflictError(detail=f"Insufficient blank pieces on-hand — available: {blank_on_hand}")
    if printed_on_hand < payload.quantity:
        raise ConflictError(detail=f"Insufficient printed transfers on-hand — available: {printed_on_hand}")

    # (2) RESOLVE / CREATE the finished Product + ProductVariation.
    product_stmt = scoped(select(Product), Product, company_id).where(
        Product.spec_id == blank.spec_id,
        Product.print_id == design.id,
    )
    product = (await db.exec(product_stmt)).first()
    if product is None:
        product = Product(
            company_id=company_id,
            name=f"{spec.name} · {design.name}",
            product_type=_DEFAULT_PRODUCT_TYPE,
            spec_id=blank.spec_id,
            print_id=design.id,
        )
        db.add(product)
        await db.flush()

    variation_stmt = scoped(select(ProductVariation), ProductVariation, company_id).where(
        ProductVariation.product_id == product.id,
        ProductVariation.size == blank.size,
        ProductVariation.color_code == blank.color_code,
    )
    variation = (await db.exec(variation_stmt)).first()
    created_new_variation = variation is None
    if variation is None:
        sku = ProductVariation.make_sku(spec.code, blank.size, blank.color_code, design.code)
        variation = ProductVariation(
            company_id=company_id,
            product_id=product.id,
            size=blank.size,
            color=blank.color,
            color_code=blank.color_code,
            sku=sku,
        )
        db.add(variation)
        await db.flush()

    # (3) INSERT the AssemblyRun first so its id is provenance for the 3 writes.
    run = AssemblyRun(
        company_id=company_id,
        blank_piece_id=blank.id,
        printed_transfer_id=transfer.id,
        variation_id=variation.id,
        quantity=payload.quantity,
        batch_id=payload.batch_id,
    )
    db.add(run)
    await db.flush()

    ref = _run_code(run.id)

    # (4) THE 3 LEDGER WRITES (run is write #1; these are #2-#4).
    await blank_stock_service.record_movement(
        db,
        company_id=company_id,
        blank_piece_id=blank.id,
        kind=BlankMovementKind.EXIT,
        quantity=payload.quantity,
        assembly_run_id=run.id,
        notes=f"Montagem {ref}",
    )
    await printed_transfer_service.record_movement(
        db,
        company_id=company_id,
        printed_transfer_id=transfer.id,
        kind=PrintedMovementKind.EXIT,
        quantity=payload.quantity,
        assembly_run_id=run.id,
        notes=f"Montagem {ref}",
    )
    db.add(
        StockEntry(
            company_id=company_id,
            variation_id=variation.id,
            quantity=payload.quantity,
            source=StockSource.ASSEMBLY,
            assembly_run_id=run.id,
            notes=f"Montagem {variation.sku}",
        )
    )
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=run.id,
        message=(
            f"Assembled {payload.quantity}x {variation.sku} (blank -{payload.quantity}, printed -{payload.quantity})"
        ),
    )
    await db.flush()

    return AssemblyRunRead(
        id=run.id,
        blank_piece_id=blank.id,
        printed_transfer_id=transfer.id,
        variation=AssemblyVariationRef(
            id=variation.id,
            sku=variation.sku,
            size=variation.size.value,
            color=variation.color,
            color_code=variation.color_code,
        ),
        sku=variation.sku,
        quantity=payload.quantity,
        created_new_variation=created_new_variation,
        batch_id=run.batch_id,
        created_at=run.created_at,
    )


async def assemble(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: AssembleBody,
) -> AssemblyRunRead:
    """T5 single-run entry point: :func:`assemble_internal` + commit."""

    result = await assemble_internal(db, company_id=company_id, user_id=user_id, payload=payload)
    await db.commit()
    return result


# --------------------------------------------------------------- buildable assist


async def list_buildable(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    filters: BuildableFilters,
    page: PageParams,
) -> tuple[list[BuildableRow], int]:
    """Computed from live on-hand (no writes).

    Every ``(printed_transfer, candidate blank)`` pair where both on-hand > 0,
    keyed: transfer is design-keyed, any blank can receive it. Sorted by
    ``max_buildable`` desc, then design code, then sku. Paginated in Python.
    """

    printed_raw = await printed_transfer_service.compute_on_hand_map(db, company_id=company_id)
    blank_raw = await blank_stock_service.compute_on_hand_map(db, company_id=company_id)
    printed_map = {k: v for k, v in printed_raw.items() if v > 0}
    blank_map = {k: v for k, v in blank_raw.items() if v > 0}
    if not printed_map or not blank_map:
        return [], 0

    # Load the positive-on-hand printed transfers + their designs (apply filters).
    transfer_stmt = scoped(select(PrintedTransfer), PrintedTransfer, company_id).where(
        PrintedTransfer.id.in_(set(printed_map))  # type: ignore[attr-defined]
    )
    if filters.print_design_id is not None:
        transfer_stmt = transfer_stmt.where(PrintedTransfer.print_design_id == filters.print_design_id)
    transfers = list((await db.exec(transfer_stmt)).all())
    if not transfers:
        return [], 0

    design_ids = {t.print_design_id for t in transfers}
    design_stmt = scoped(select(PrintDesign), PrintDesign, company_id).where(
        PrintDesign.id.in_(design_ids)  # type: ignore[attr-defined]
    )
    designs = {d.id: d for d in (await db.exec(design_stmt)).all()}
    if filters.q:
        needle = filters.q.strip().lower()
        designs = {did: d for did, d in designs.items() if needle in d.code.lower() or needle in d.name.lower()}
    transfers = [t for t in transfers if t.print_design_id in designs]
    if not transfers:
        return [], 0

    # Load the positive-on-hand blanks + their specs (apply spec filter).
    blank_stmt = scoped(select(BlankPiece), BlankPiece, company_id).where(
        BlankPiece.id.in_(set(blank_map))  # type: ignore[attr-defined]
    )
    if filters.spec_id is not None:
        blank_stmt = blank_stmt.where(BlankPiece.spec_id == filters.spec_id)
    blanks = list((await db.exec(blank_stmt)).all())
    if not blanks:
        return [], 0

    spec_ids = {b.spec_id for b in blanks}
    spec_stmt = scoped(select(ProductSpec), ProductSpec, company_id).where(
        ProductSpec.id.in_(spec_ids)  # type: ignore[attr-defined]
    )
    specs = {s.id: s for s in (await db.exec(spec_stmt)).all()}

    rows: list[BuildableRow] = []
    for transfer in transfers:
        design = designs[transfer.print_design_id]
        printed_on_hand = printed_map.get(transfer.id, 0)
        if printed_on_hand <= 0:
            continue
        for blank in blanks:
            blank_on_hand = blank_map.get(blank.id, 0)
            if blank_on_hand <= 0:
                continue
            spec = specs.get(blank.spec_id)
            if spec is None:  # pragma: no cover — FK-guarded
                continue
            sku = ProductVariation.make_sku(spec.code, blank.size, blank.color_code, design.code)
            rows.append(
                BuildableRow(
                    printed_transfer_id=transfer.id,
                    design=PrintDesignRef(
                        id=design.id,
                        code=design.code,
                        name=design.name,
                        technique=design.technique,
                        image_url=design.image_url,
                    ),
                    side=transfer.side,
                    printed_on_hand=printed_on_hand,
                    blank=BuildableBlankRef(
                        blank_piece_id=blank.id,
                        spec=BuildableSpecRef(id=spec.id, code=spec.code, name=spec.name),
                        size=blank.size.value,
                        color=blank.color,
                        color_code=blank.color_code,
                        on_hand=blank_on_hand,
                    ),
                    sku=sku,
                    max_buildable=min(blank_on_hand, printed_on_hand),
                    product_type=_DEFAULT_PRODUCT_TYPE,
                )
            )

    rows.sort(key=lambda r: (-r.max_buildable, r.design.code, r.sku))
    total = len(rows)
    return rows[page.offset : page.offset + page.page_size], total


__all__ = [
    "assemble",
    "assemble_internal",
    "list_buildable",
]
