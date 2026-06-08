"""Read-side service for per-piece order separation items (Separação)."""

import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import OrderItem
from services._base import scoped


async def list_order_items(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    order_id: uuid.UUID,
) -> list[OrderItem]:
    """All separation pieces for an order, ordered by their position in the order."""
    stmt = (
        scoped(select(OrderItem), OrderItem, company_id)
        .where(OrderItem.order_id == order_id)
        .order_by(OrderItem.item_index.asc())  # type: ignore[attr-defined]
    )
    return list((await db.exec(stmt)).all())
