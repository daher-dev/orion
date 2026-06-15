"""Unit tests for the shared on-hand reader module.

These thin wrappers are the single import surface downstream consumers use.
They must agree with each tier's own on-hand computation.
"""

from decimal import Decimal

from models import BlankMovementKind, PrintedMovementKind
from schemas.blank_stock import BlankMovementCreate
from schemas.paper_roll import PaperRollConsume
from schemas.printed_transfer import PrintedMovementCreate
from services import blank_stock as blank_service
from services import inventory_on_hand
from services import paper_roll as paper_service
from services import printed_transfer as printed_service
from tests.factories import (
    create_blank_piece,
    create_company,
    create_paper_roll,
    create_print_design,
    create_printed_transfer,
    create_product_spec,
    create_user,
)


async def _setup(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    return company, user


async def test_blank_on_hand_matches_service(db_session):
    company, user = await _setup(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    await blank_service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=piece.id, kind=BlankMovementKind.ENTRY, quantity=42),
    )
    assert await inventory_on_hand.blank_on_hand(db_session, company_id=company.id, blank_piece_id=piece.id) == 42


async def test_printed_on_hand_matches_service(db_session):
    company, user = await _setup(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    await printed_service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintedMovementCreate(printed_transfer_id=transfer.id, kind=PrintedMovementKind.ENTRY, quantity=7),
    )
    assert (
        await inventory_on_hand.printed_on_hand(db_session, company_id=company.id, printed_transfer_id=transfer.id) == 7
    )


async def test_paper_on_hand_returns_current_meters(db_session):
    company, user = await _setup(db_session)
    roll = await create_paper_roll(db_session, company_id=company.id, current_meters=Decimal("64.00"))
    await paper_service.consume(
        db_session,
        company_id=company.id,
        user_id=user.id,
        roll_id=roll.id,
        payload=PaperRollConsume(quantity=Decimal("14.000")),
    )
    assert await inventory_on_hand.paper_on_hand(db_session, company_id=company.id, paper_roll_id=roll.id) == Decimal(
        "50.00"
    )


async def test_bulk_maps(db_session):
    company, user = await _setup(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    piece = await create_blank_piece(db_session, company_id=company.id, spec_id=spec.id)
    design = await create_print_design(db_session, company_id=company.id)
    transfer = await create_printed_transfer(db_session, company_id=company.id, print_design_id=design.id)
    await blank_service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=BlankMovementCreate(blank_piece_id=piece.id, kind=BlankMovementKind.ENTRY, quantity=5),
    )
    await printed_service.create_movement(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=PrintedMovementCreate(printed_transfer_id=transfer.id, kind=PrintedMovementKind.ENTRY, quantity=6),
    )
    blank_map = await inventory_on_hand.blank_on_hand_map(db_session, company_id=company.id)
    printed_map = await inventory_on_hand.printed_on_hand_map(db_session, company_id=company.id)
    assert blank_map[piece.id] == 5
    assert printed_map[transfer.id] == 6
