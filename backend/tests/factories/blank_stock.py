import random
import string
import uuid

from polyfactory import Use
from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import BlankMovementKind, BlankPiece, BlankPieceMovement, Size


def _color_code() -> str:
    """A random 3-letter uppercase code (matches the `^[A-Z]{3}$` constraint)."""

    return "".join(random.choices(string.ascii_uppercase, k=3))


class BlankPieceFactory(ModelFactory[BlankPiece]):
    __model__ = BlankPiece
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    size = Size.M
    color = "Preto"
    color_code = Use(_color_code)
    min_stock = None


class BlankPieceMovementFactory(ModelFactory[BlankPieceMovement]):
    __model__ = BlankPieceMovement
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    kind = BlankMovementKind.ENTRY
    quantity = 10
    sewing_shipment_id = None
    notes = None


async def create_blank_piece(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    spec_id: uuid.UUID,
    **overrides,
) -> BlankPiece:
    piece = BlankPieceFactory.build(company_id=company_id, spec_id=spec_id, **overrides)
    db.add(piece)
    await db.commit()
    await db.refresh(piece)
    return piece


async def create_blank_piece_movement(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    blank_piece_id: uuid.UUID,
    **overrides,
) -> BlankPieceMovement:
    movement = BlankPieceMovementFactory.build(company_id=company_id, blank_piece_id=blank_piece_id, **overrides)
    db.add(movement)
    await db.commit()
    await db.refresh(movement)
    return movement
