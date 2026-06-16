"""Unit tests for the Assembly (Montagem) service layer — T5.

Coverage targets
----------------
- assemble: resolves an existing Product/variation vs creates a new SKU;
  writes the 3 ledger rows with run provenance; credits finished stock.
- guard: insufficient blank or printed → 409 with no partial writes.
- buildable: min(blank, printed) math; filters; empty when a tier is empty.
- tenant isolation; batch_id passthrough.
"""

import uuid

import pytest
from sqlmodel import select

from models import (
    AssemblyRun,
    BlankMovementKind,
    BlankPieceMovement,
    PrintedMovementKind,
    PrintedTransferMovement,
    ProductVariation,
    Size,
    StockEntry,
    StockSource,
)
from schemas._common import PageParams
from schemas.assembly import AssembleBody, BuildableFilters
from services import assembly as service
from services import blank_stock as blank_stock_service
from services import printed_transfer as printed_transfer_service
from services import stock as stock_service
from shared.exceptions import ConflictError, NotFoundError, ValidationError
from tests.factories import (
    create_blank_piece,
    create_blank_piece_movement,
    create_company,
    create_print_design,
    create_printed_transfer,
    create_printed_transfer_movement,
    create_product,
    create_product_spec,
    create_product_variation,
    create_user,
)

PAGE = PageParams(page=1, page_size=50)


async def _setup_pair(db_session, *, blank_qty=10, printed_qty=10, color_code="PRT"):
    """A company with one blank piece (+stock) and one printed transfer (+stock)."""

    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="CAM01", name="Camiseta")
    design = await create_print_design(db_session, company_id=company.id, code="FLR03", name="Floral")
    blank = await create_blank_piece(
        db_session, company_id=company.id, spec_id=spec.id, size=Size.M, color="Preto", color_code=color_code
    )
    if blank_qty:
        await create_blank_piece_movement(
            db_session,
            company_id=company.id,
            blank_piece_id=blank.id,
            kind=BlankMovementKind.ENTRY,
            quantity=blank_qty,
        )
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    if printed_qty:
        await create_printed_transfer_movement(
            db_session,
            company_id=company.id,
            printed_transfer_id=transfer.id,
            kind=PrintedMovementKind.ENTRY,
            quantity=printed_qty,
        )
    return company, user, spec, design, blank, transfer


# ---------- assemble ----------


async def test_assemble_creates_new_sku(db_session):
    company, user, spec, design, blank, transfer = await _setup_pair(db_session)
    run = await service.assemble(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=AssembleBody(blank_piece_id=blank.id, printed_transfer_id=transfer.id, quantity=6),
    )
    assert run.created_new_variation is True
    assert run.sku == ProductVariation.make_sku(spec.code, Size.M, "PRT", design.code)
    assert run.quantity == 6

    # On-hand effects.
    assert await blank_stock_service._compute_on_hand(db_session, company_id=company.id, blank_piece_id=blank.id) == 4
    assert (
        await printed_transfer_service._compute_on_hand(
            db_session, company_id=company.id, printed_transfer_id=transfer.id
        )
        == 4
    )
    assert await stock_service._compute_on_hand(db_session, company_id=company.id, variation_id=run.variation.id) == 6

    # Provenance on all 3 ledger writes.
    blank_moves = list(
        (await db_session.exec(select(BlankPieceMovement).where(BlankPieceMovement.assembly_run_id == run.id))).all()
    )
    printed_moves = list(
        (
            await db_session.exec(
                select(PrintedTransferMovement).where(PrintedTransferMovement.assembly_run_id == run.id)
            )
        ).all()
    )
    entry = (await db_session.exec(select(StockEntry).where(StockEntry.assembly_run_id == run.id))).first()
    assert len(blank_moves) == 1 and blank_moves[0].kind == BlankMovementKind.EXIT
    assert len(printed_moves) == 1 and printed_moves[0].kind == PrintedMovementKind.EXIT
    assert entry is not None and entry.source == StockSource.ASSEMBLY and entry.quantity == 6


async def test_assemble_resolves_existing_variation(db_session):
    company, user, spec, design, blank, transfer = await _setup_pair(db_session)
    # Pre-create the Product + variation that assembly would resolve to.
    product = await create_product(
        db_session, company_id=company.id, spec_id=spec.id, print_id=design.id, name="Pre-existing"
    )
    sku = ProductVariation.make_sku(spec.code, Size.M, "PRT", design.code)
    existing = await create_product_variation(
        db_session,
        company_id=company.id,
        product_id=product.id,
        size=Size.M,
        color="Preto",
        color_code="PRT",
        sku=sku,
    )
    run = await service.assemble(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=AssembleBody(blank_piece_id=blank.id, printed_transfer_id=transfer.id, quantity=3),
    )
    assert run.created_new_variation is False
    assert run.variation.id == existing.id
    assert run.sku == sku


async def test_assemble_guard_insufficient_blank_no_writes(db_session):
    company, user, _spec, _design, blank, transfer = await _setup_pair(db_session, blank_qty=2, printed_qty=10)
    with pytest.raises(ConflictError):
        await service.assemble(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=AssembleBody(blank_piece_id=blank.id, printed_transfer_id=transfer.id, quantity=5),
        )
    assert len(list((await db_session.exec(select(AssemblyRun))).all())) == 0
    assert len(list((await db_session.exec(select(StockEntry))).all())) == 0
    # Blank on-hand unchanged.
    assert await blank_stock_service._compute_on_hand(db_session, company_id=company.id, blank_piece_id=blank.id) == 2


async def test_assemble_guard_insufficient_printed_no_writes(db_session):
    company, user, _spec, _design, blank, transfer = await _setup_pair(db_session, blank_qty=10, printed_qty=2)
    with pytest.raises(ConflictError):
        await service.assemble(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=AssembleBody(blank_piece_id=blank.id, printed_transfer_id=transfer.id, quantity=5),
        )
    assert len(list((await db_session.exec(select(AssemblyRun))).all())) == 0
    assert (
        await printed_transfer_service._compute_on_hand(
            db_session, company_id=company.id, printed_transfer_id=transfer.id
        )
        == 2
    )


async def test_assemble_missing_blank_404(db_session):
    company, user, _spec, _design, _blank, transfer = await _setup_pair(db_session)
    with pytest.raises(NotFoundError):
        await service.assemble(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=AssembleBody(blank_piece_id=uuid.uuid4(), printed_transfer_id=transfer.id, quantity=1),
        )


async def test_assemble_batch_passthrough_and_validation(db_session):
    company, user, _spec, _design, blank, transfer = await _setup_pair(db_session)
    # An unknown batch id → ValidationError.
    with pytest.raises(ValidationError):
        await service.assemble(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=AssembleBody(
                blank_piece_id=blank.id, printed_transfer_id=transfer.id, quantity=1, batch_id=uuid.uuid4()
            ),
        )


# ---------- buildable ----------


async def test_buildable_math_min(db_session):
    company, _user, spec, design, _blank, _transfer = await _setup_pair(db_session, blank_qty=7, printed_qty=4)
    rows, total = await service.list_buildable(db_session, company_id=company.id, filters=BuildableFilters(), page=PAGE)
    assert total == 1
    row = rows[0]
    assert row.printed_on_hand == 4
    assert row.blank.on_hand == 7
    assert row.max_buildable == 4  # min(7, 4)
    assert row.sku == ProductVariation.make_sku(spec.code, Size.M, "PRT", design.code)


async def test_buildable_empty_when_no_printed(db_session):
    company, _user, _spec, _design, _blank, _transfer = await _setup_pair(db_session, blank_qty=10, printed_qty=0)
    rows, total = await service.list_buildable(db_session, company_id=company.id, filters=BuildableFilters(), page=PAGE)
    assert total == 0
    assert rows == []


async def test_buildable_spec_filter(db_session):
    company, _user, _spec, _design, _blank, _transfer = await _setup_pair(db_session)
    other_spec = await create_product_spec(db_session, company_id=company.id, code="MOL01")
    _rows, total = await service.list_buildable(
        db_session, company_id=company.id, filters=BuildableFilters(spec_id=other_spec.id), page=PAGE
    )
    assert total == 0


async def test_buildable_is_tenant_scoped(db_session):
    company, _user, _spec, _design, _blank, _transfer = await _setup_pair(db_session)
    await _setup_pair(db_session)
    _rows, total = await service.list_buildable(
        db_session, company_id=company.id, filters=BuildableFilters(), page=PAGE
    )
    # Only this tenant's single pair.
    assert total == 1
