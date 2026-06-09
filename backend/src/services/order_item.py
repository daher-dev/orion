"""Service for per-piece order separation items (Separação).

The separation workflow has three stages on each :class:`OrderItem`
(``SeparationStatus``): ``pending`` → ``label_printed`` → ``checked``.

- :func:`list_order_items` reads the pieces for an order.
- :func:`generate_labels` lazily materializes one piece per unit of an order's
  ``quantity`` (live/Upseller orders never create ``OrderItem`` rows — only the
  base44 import does), assigns a deterministic per-piece ``tracking_code``, and
  flips ``pending`` → ``label_printed``. It is idempotent: re-running reuses the
  existing pieces and never re-inserts (the partial-unique tracking_code index
  would otherwise raise), and never resets an already-``checked`` piece.
- :func:`scan_check` resolves a piece by ``tracking_code`` within the tenant and
  flips ``label_printed`` → ``checked`` (idempotent if already checked, rejects a
  still-``pending`` piece whose label was never printed).
"""

import hashlib
import uuid
from datetime import UTC, datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Order, OrderItem, Product, ProductVariation, SeparationStatus, Size
from schemas.separation import GenerateLabelsResponse, ScanCheckResponse, SeparationLabel
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ConflictError, NotFoundError

_RESOURCE = "orders"
_BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _short_code(value: uuid.UUID) -> str:
    """Compact human order code (mirrors :func:`services.order._short_code`)."""

    return f"ORD-{value.hex[:8].upper()}"


def _piece_tracking_code(order_id: uuid.UUID, item_index: int) -> str:
    """Deterministic per-piece tracking code: ``ORD-XXXXXXXX-<idx>-<6 base36>``.

    Mirrors the legacy/design ``pieceCode`` (``{order}-{idx}-{6charbase36}``).
    Deterministic in (order_id, item_index) so :func:`generate_labels` can be
    re-run without minting a new code or hitting the partial-unique index.
    """

    seed = f"{order_id.hex}:{item_index}".encode()
    digest = hashlib.sha256(seed).digest()
    acc = int.from_bytes(digest[:8], "big")
    suffix = ""
    for _ in range(6):
        acc, rem = divmod(acc, 36)
        suffix += _BASE36[rem]
    return f"{_short_code(order_id)}-{item_index}-{suffix}"


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


async def _load_order(db: AsyncSession, *, company_id: uuid.UUID, order_id: uuid.UUID) -> Order:
    order = (await db.exec(scoped(select(Order), Order, company_id).where(Order.id == order_id))).first()
    if order is None:
        raise NotFoundError(detail="Order not found")
    return order


async def _label_decorations(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    variation_id: uuid.UUID | None,
) -> tuple[str | None, str | None, str | None, str | None, Size | None]:
    """Best-effort SKU/product/color/size for an order's variation (label face)."""
    if variation_id is None:
        return None, None, None, None, None
    row = (
        await db.exec(
            select(ProductVariation, Product.name)
            .join(Product, Product.id == ProductVariation.product_id)
            .where(ProductVariation.company_id == company_id, ProductVariation.id == variation_id)
        )
    ).first()
    if row is None:
        return None, None, None, None, None
    variation, product_name = row
    return variation.sku, product_name, variation.color, variation.color_code, variation.size


def _to_label(item: OrderItem, *, decorations) -> SeparationLabel:
    sku, product_name, color, color_code, size = decorations
    return SeparationLabel(
        item_id=item.id,
        order_id=item.order_id,
        order_code=_short_code(item.order_id),
        tracking_code=item.tracking_code or "",
        qr_data=item.tracking_code or "",
        item_index=item.item_index,
        total_items=item.total_items,
        status=item.status,
        sku=sku,
        product_name=product_name,
        color=color,
        color_code=color_code,
        size=size,
        mapped_print=item.mapped_print,
    )


async def generate_labels(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    order_id: uuid.UUID,
) -> GenerateLabelsResponse:
    """Materialize (if needed) and print separation labels for an order.

    Live/Upseller orders never create ``OrderItem`` rows, so the first call
    lazily inserts one piece per unit of ``Order.quantity`` (``item_index`` 1..N,
    ``total_items`` = N) with a deterministic per-piece ``tracking_code``. Pieces
    are then flipped ``pending`` → ``label_printed``. Idempotent: re-running
    reuses existing pieces (no duplicate inserts) and leaves ``checked`` pieces
    untouched.
    """

    order = await _load_order(db, company_id=company_id, order_id=order_id)

    existing = await list_order_items(db, company_id=company_id, order_id=order_id)
    total = order.quantity

    if not existing:
        # Lazily materialize one piece per physical unit (idempotent code).
        for index in range(1, total + 1):
            db.add(
                OrderItem(
                    company_id=company_id,
                    order_id=order_id,
                    variation_id=order.variation_id,
                    tracking_code=_piece_tracking_code(order_id, index),
                    status=SeparationStatus.LABEL_PRINTED,
                    item_index=index,
                    total_items=total,
                )
            )
        await db.flush()
    else:
        # Re-print: backfill any missing tracking code, flip pending pieces to
        # label_printed, but never reset a piece that's already checked.
        for item in existing:
            if item.tracking_code is None:
                item.tracking_code = _piece_tracking_code(order_id, item.item_index or 1)
            if item.status == SeparationStatus.PENDING:
                item.status = SeparationStatus.LABEL_PRINTED
            db.add(item)
        await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=order_id,
        message=f"Printed {total} separation label(s) for order {_short_code(order_id)}",
    )
    await db.commit()

    items = await list_order_items(db, company_id=company_id, order_id=order_id)
    decorations = await _label_decorations(db, company_id=company_id, variation_id=order.variation_id)
    labels = [_to_label(item, decorations=decorations) for item in items]
    return GenerateLabelsResponse(
        order_id=order_id,
        order_code=_short_code(order_id),
        total_items=len(labels),
        labels=labels,
    )


async def scan_check(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    user_email: str | None,
    tracking_code: str,
) -> ScanCheckResponse:
    """Scan-to-check a piece by its label's ``tracking_code`` (tenant-scoped).

    Flips ``label_printed`` → ``checked`` and records ``checked_at`` / ``checked_by``.
    Idempotent if the piece is already ``checked``. Rejects a still-``pending``
    piece (its label was never printed) with a 409 — matching the design's
    print-then-scan flow. Unknown codes 404.
    """

    code = tracking_code.strip()
    item = (
        await db.exec(scoped(select(OrderItem), OrderItem, company_id).where(OrderItem.tracking_code == code))
    ).first()
    if item is None:
        raise NotFoundError(detail="No separation piece matches that code")

    if item.status == SeparationStatus.CHECKED:
        return _scan_response(item, already_checked=True)

    if item.status == SeparationStatus.PENDING:
        raise ConflictError(detail="Print the label before scanning this piece")

    item.status = SeparationStatus.CHECKED
    item.checked_at = datetime.now(UTC)
    item.checked_by = user_email
    db.add(item)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=item.order_id,
        message=f"Checked piece {code} (order {_short_code(item.order_id)})",
    )
    await db.commit()
    await db.refresh(item)
    return _scan_response(item, already_checked=False)


def _scan_response(item: OrderItem, *, already_checked: bool) -> ScanCheckResponse:
    return ScanCheckResponse(
        item_id=item.id,
        order_id=item.order_id,
        tracking_code=item.tracking_code or "",
        status=item.status,
        item_index=item.item_index,
        total_items=item.total_items,
        checked_at=item.checked_at,
        checked_by=item.checked_by,
        already_checked=already_checked,
    )
