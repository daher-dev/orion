"""Shared on-hand readers for the WIP inventory tiers.

A single import surface so downstream consumers (Assembly P4, Planning P5,
Lotes P6) have ONE place to ask "how many are available" for each tier — they
must not re-implement the netting. These thin wrappers delegate to the per-tier
services (no new query logic):

- counted tiers (blank, printed): on-hand = signed sum of the ledger
  (``sum(entry+adjustment qty) - sum(exit qty)``), computed live.
- metered tier (paper): on-hand = the roll's authoritative ``current_meters``
  column.

Bulk maps are provided for the counted tiers so a downstream pass can net the
whole tenant in one query.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlmodel.ext.asyncio.session import AsyncSession

from services import blank_stock as _blank
from services import paper_roll as _paper
from services import printed_transfer as _printed


async def blank_on_hand(db: AsyncSession, *, company_id: uuid.UUID, blank_piece_id: uuid.UUID) -> int:
    """Live on-hand count for a single blank piece."""

    return await _blank._compute_on_hand(db, company_id=company_id, blank_piece_id=blank_piece_id)


async def printed_on_hand(db: AsyncSession, *, company_id: uuid.UUID, printed_transfer_id: uuid.UUID) -> int:
    """Live on-hand count for a single printed transfer."""

    return await _printed._compute_on_hand(db, company_id=company_id, printed_transfer_id=printed_transfer_id)


async def paper_on_hand(db: AsyncSession, *, company_id: uuid.UUID, paper_roll_id: uuid.UUID) -> Decimal:
    """On-hand meters for a single paper roll (= its ``current_meters`` column)."""

    roll = await _paper.get_paper_roll(db, company_id=company_id, roll_id=paper_roll_id)
    return roll.current_meters


async def blank_on_hand_map(db: AsyncSession, *, company_id: uuid.UUID) -> dict[uuid.UUID, int]:
    """Bulk ``{blank_piece_id: on_hand}`` for the tenant (counted tier netting)."""

    return await _blank.compute_on_hand_map(db, company_id=company_id)


async def printed_on_hand_map(db: AsyncSession, *, company_id: uuid.UUID) -> dict[uuid.UUID, int]:
    """Bulk ``{printed_transfer_id: on_hand}`` for the tenant (counted tier netting)."""

    return await _printed.compute_on_hand_map(db, company_id=company_id)


__all__ = [
    "blank_on_hand",
    "blank_on_hand_map",
    "paper_on_hand",
    "printed_on_hand",
    "printed_on_hand_map",
]
