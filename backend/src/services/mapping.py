"""Service layer for the De/Para mapping feature (order-item → variation).

Each imported :class:`OrderItem` whose ``variation_id`` is still ``NULL`` is a
"pending" De/Para row. This module resolves those rows to the correct internal
:class:`ProductVariation` (SKU) of the right :class:`Product`, scored by
ad-title / colour / size token overlap. The estampa is a consequence of the
matched variation's product (``Product.print_id`` → :class:`PrintDesign`).

Heuristic
---------
Token-overlap only (no LLM), mirroring the ``suggestMapping`` logic in
``docs/design/pages/lotes.jsx``:

- Candidate variations are restricted to the products the order's Ad sells
  (the union across ``ad_products`` — an ad may list several products),
  exactly like :func:`services.order.create_order`.
- The ad title is tokenised with a stop-word list (garment nouns, marketing
  words) so generic words don't inflate the score.
- The marketplace variation text (``cor · tamanho`` from the 1:1
  :class:`ImportedOrder`) contributes high-signal colour + size hits.
- Ambiguous ties (two variations with the equal top score) yield **no**
  suggestion rather than a silent mis-map.

Each accept / swap sets ``OrderItem.variation_id`` (tenant-scoped and validated
that the variation belongs to one of the Ad's products) and writes an audit
entry under ``resource_type="orders"``.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field

from sqlalchemy import func, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    Ad,
    AdProduct,
    ImportedOrder,
    Order,
    OrderItem,
    PrintDesign,
    Product,
    ProductVariation,
)
from schemas._common import PageParams
from schemas.mapping import (
    AcceptAllResult,
    MappingFilter,
    MappingItem,
    MappingItemsResponse,
    MappingProgress,
    MappingSuggestion,
)
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import NotFoundError, ValidationError

_RESOURCE = "orders"


# ----------------------------------------------------------------- tokenisation

# Stop-words mirror docs/design/pages/lotes.jsx FF_STOP: garment nouns +
# marketing words that carry no product-identity signal.
_STOP: frozenset[str] = frozenset(
    {
        "camiseta",
        "moletom",
        "cropped",
        "ecobag",
        "bolsa",
        "canguru",
        "anime",
        "algodao",
        "unissex",
        "premium",
        "sem",
        "variacao",
        "no",
        "anuncio",
        "gola",
        "manga",
        "oversized",
        "masculina",
        "feminina",
        "blusa",
        "shippuden",
    }
)


def _norm(value: str) -> str:
    """Lowercase + strip accents (NFD-style), matching ``ffNorm`` in the design."""

    lowered = value.lower()
    return (
        lowered.replace("ã", "a")
        .replace("á", "a")
        .replace("â", "a")
        .replace("à", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
        .replace("ü", "u")
        .replace("ç", "c")
    )


def _title_tokens(value: str) -> set[str]:
    """Significant tokens from an ad title — drops short + stop words."""

    raw = re.split(r"[^a-z0-9]+", _norm(value))
    return {t for t in raw if len(t) > 2 and t not in _STOP}


def _split_variation_text(variation_text: str | None) -> tuple[str | None, str | None]:
    """Split a marketplace variation ("Preto · M") into (colour, size) norms.

    Mirrors the ``·`` split in the design's ``suggestMapping``; tolerant of
    missing parts. Returns normalised strings (or None).
    """

    if not variation_text:
        return None, None
    parts = [p.strip() for p in variation_text.split("·")]
    color = _norm(parts[0]) if parts and parts[0] else None
    size = _norm(parts[1]) if len(parts) > 1 and parts[1] else None
    return color, size


# --------------------------------------------------------------------- scoring


@dataclass(slots=True)
class _Candidate:
    variation: ProductVariation
    product: Product


def _score(
    *,
    title_tokens: set[str],
    var_color: str | None,
    var_size: str | None,
    candidate: _Candidate,
) -> int:
    """Token-overlap score for one candidate variation.

    Boosts exact colour + size hits from the marketplace variation text.
    """

    product = candidate.product
    variation = candidate.variation

    name_tokens = _title_tokens(product.name) | {
        _norm(variation.color),
        variation.color_code.lower(),
        variation.size.value,
    }
    score = len(title_tokens & name_tokens)

    # SKU verbatim in the title is a strong signal.
    if variation.sku and variation.sku.lower() in title_tokens:
        score += 5

    # High-signal exact colour / size from the marketplace variation text.
    if var_size is not None and var_size == variation.size.value:
        score += 2
    if var_color is not None and var_color in (_norm(variation.color), variation.color_code.lower()):
        score += 2

    return score


def _best_suggestion(
    *,
    ad_title: str,
    variation_text: str | None,
    candidates: list[_Candidate],
    prints: dict[uuid.UUID, PrintDesign],
) -> MappingSuggestion | None:
    """Pick the single best candidate, or None when ambiguous / no overlap."""

    if not candidates:
        return None

    title_tokens = _title_tokens(ad_title)
    var_color, var_size = _split_variation_text(variation_text)

    scored: list[tuple[int, _Candidate]] = []
    for candidate in candidates:
        score = _score(
            title_tokens=title_tokens,
            var_color=var_color,
            var_size=var_size,
            candidate=candidate,
        )
        scored.append((score, candidate))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    if not scored or scored[0][0] <= 0:
        return None
    # Reject ambiguous ties between the top two candidates.
    if len(scored) > 1 and scored[0][0] == scored[1][0]:
        return None

    best_score, best = scored[0]
    return _to_suggestion(best, score=best_score, prints=prints)


def _to_suggestion(candidate: _Candidate, *, score: int, prints: dict[uuid.UUID, PrintDesign]) -> MappingSuggestion:
    design = prints.get(candidate.product.print_id) if candidate.product.print_id else None
    return MappingSuggestion(
        variation_id=candidate.variation.id,
        product_id=candidate.product.id,
        product_name=candidate.product.name,
        sku=candidate.variation.sku,
        color=candidate.variation.color,
        size=candidate.variation.size,
        print_design_code=design.code if design else None,
        print_design_name=design.name if design else None,
        score=score,
    )


# ----------------------------------------------------------------- load context


@dataclass(slots=True)
class _Context:
    """Per-call cache of the catalog needed to score every pending row."""

    company_id: uuid.UUID
    # ad_id -> candidate variations (union across the ad's products)
    candidates_by_ad: dict[uuid.UUID, list[_Candidate]] = field(default_factory=dict)
    # variation_id -> (variation, product) for resolving linked rows
    variation_index: dict[uuid.UUID, _Candidate] = field(default_factory=dict)
    prints: dict[uuid.UUID, PrintDesign] = field(default_factory=dict)


async def _build_context(db: AsyncSession, *, company_id: uuid.UUID) -> _Context:
    ctx = _Context(company_id=company_id)

    variations = list((await db.exec(scoped(select(ProductVariation), ProductVariation, company_id))).all())
    products = list((await db.exec(scoped(select(Product), Product, company_id))).all())
    products_by_id = {p.id: p for p in products}

    by_product: dict[uuid.UUID, list[_Candidate]] = {}
    for variation in variations:
        product = products_by_id.get(variation.product_id)
        if product is None:
            continue
        candidate = _Candidate(variation=variation, product=product)
        ctx.variation_index[variation.id] = candidate
        by_product.setdefault(variation.product_id, []).append(candidate)

    # Candidate set per ad = union of variations across all the ad's products.
    ad_product_rows = (
        await db.exec(select(AdProduct.ad_id, AdProduct.product_id).where(AdProduct.company_id == company_id))
    ).all()
    for ad_id, product_id in ad_product_rows:
        ctx.candidates_by_ad.setdefault(ad_id, []).extend(by_product.get(product_id, []))

    prints = list((await db.exec(scoped(select(PrintDesign), PrintDesign, company_id))).all())
    ctx.prints = {p.id: p for p in prints}

    return ctx


# A loaded De/Para source row: the OrderItem + its Order's ad + the 1:1
# ImportedOrder snapshot fields (ad title / variation text / ad sku).
_ItemRow = tuple[OrderItem, Ad, str | None, str | None, str | None]


def _item_select():
    """Join OrderItem → Order → Ad and (outer) the 1:1 ImportedOrder snapshot."""

    return (
        select(
            OrderItem,
            Ad,
            ImportedOrder.ad_title,
            ImportedOrder.variation_text,
            ImportedOrder.sku,
        )
        .join(Order, Order.id == OrderItem.order_id)
        .join(Ad, Ad.id == Order.ad_id)
        .join(ImportedOrder, ImportedOrder.order_id == Order.id, isouter=True)
    )


def _row_to_item(row: _ItemRow, ctx: _Context) -> MappingItem:
    item, ad, imported_title, variation_text, ad_sku = row
    # Prefer the marketplace-captured ad title; fall back to the Ad's own title.
    ad_title = imported_title or ad.title

    linked = item.variation_id is not None
    base = MappingItem(
        id=item.id,
        order_id=item.order_id,
        ad_id=ad.id,
        ad_title=ad_title,
        channel=ad.ecommerce,
        ad_sku=ad_sku,
        variation_text=variation_text,
        linked=linked,
    )

    if linked:
        candidate = ctx.variation_index.get(item.variation_id)  # type: ignore[arg-type]
        if candidate is not None:
            design = ctx.prints.get(candidate.product.print_id) if candidate.product.print_id else None
            base.variation_id = candidate.variation.id
            base.sku = candidate.variation.sku
            base.product_id = candidate.product.id
            base.product_name = candidate.product.name
            base.color = candidate.variation.color
            base.size = candidate.variation.size
            base.print_design_code = design.code if design else None
            base.print_design_name = design.name if design else None
        else:
            # Orphaned (cross-tenant / deleted) variation reference — keep the id.
            base.variation_id = item.variation_id
        return base

    base.suggestion = _best_suggestion(
        ad_title=ad_title,
        variation_text=variation_text,
        candidates=ctx.candidates_by_ad.get(ad.id, []),
        prints=ctx.prints,
    )
    return base


# ----------------------------------------------------------------------- list


def _apply_search(stmt, q: str | None):
    if not q:
        return stmt
    like = f"%{q.strip().lower()}%"
    return stmt.where(
        or_(
            func.lower(Ad.title).like(like),
            func.lower(ImportedOrder.ad_title).like(like),
            func.lower(ImportedOrder.sku).like(like),
            func.lower(ImportedOrder.variation_text).like(like),
        )
    )


async def _progress(db: AsyncSession, *, company_id: uuid.UUID, ctx: _Context) -> MappingProgress:
    """Global counts across the whole tenant dataset (not the page slice)."""

    total = int((await db.exec(scoped(select(func.count()).select_from(OrderItem), OrderItem, company_id))).one() or 0)
    linked = int(
        (
            await db.exec(
                scoped(select(func.count()).select_from(OrderItem), OrderItem, company_id).where(
                    OrderItem.variation_id.is_not(None)  # type: ignore[union-attr]
                )
            )
        ).one()
        or 0
    )
    pending = total - linked

    with_suggestion = 0
    if pending:
        pending_stmt = (
            _item_select().where(Order.company_id == company_id, OrderItem.variation_id.is_(None))  # type: ignore[union-attr]
        )
        for row in (await db.exec(pending_stmt)).all():
            item = _row_to_item(row, ctx)  # type: ignore[arg-type]
            if item.suggestion is not None:
                with_suggestion += 1

    return MappingProgress(total=total, linked=linked, pending=pending, with_suggestion=with_suggestion)


async def list_items(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    mapping_filter: MappingFilter = MappingFilter.PENDING,
    q: str | None = None,
    page: PageParams | None = None,
) -> MappingItemsResponse:
    page = page or PageParams()
    ctx = await _build_context(db, company_id=company_id)

    base = _item_select().where(Order.company_id == company_id)
    if mapping_filter is MappingFilter.PENDING:
        base = base.where(OrderItem.variation_id.is_(None))  # type: ignore[union-attr]
    elif mapping_filter is MappingFilter.LINKED:
        base = base.where(OrderItem.variation_id.is_not(None))  # type: ignore[union-attr]
    base = _apply_search(base, q)

    count_stmt = (
        select(func.count())
        .select_from(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Ad, Ad.id == Order.ad_id)
        .join(ImportedOrder, ImportedOrder.order_id == Order.id, isouter=True)
        .where(Order.company_id == company_id)
    )
    if mapping_filter is MappingFilter.PENDING:
        count_stmt = count_stmt.where(OrderItem.variation_id.is_(None))  # type: ignore[union-attr]
    elif mapping_filter is MappingFilter.LINKED:
        count_stmt = count_stmt.where(OrderItem.variation_id.is_not(None))  # type: ignore[union-attr]
    count_stmt = _apply_search(count_stmt, q)
    total = int((await db.exec(count_stmt)).one() or 0)

    rows_stmt = (
        base.order_by(OrderItem.created_at.desc())  # type: ignore[attr-defined]
        .offset(page.offset)
        .limit(page.page_size)
    )
    rows = (await db.exec(rows_stmt)).all()
    items = [_row_to_item(row, ctx) for row in rows]  # type: ignore[arg-type]

    progress = await _progress(db, company_id=company_id, ctx=ctx)

    return MappingItemsResponse(
        items=items,
        total=total,
        page=page.page,
        page_size=page.page_size,
        has_more=(page.page * page.page_size) < total,
        progress=progress,
    )


# ----------------------------------------------------------- resolve + mutate


async def _load_item_with_ad(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    item_id: uuid.UUID,
) -> tuple[OrderItem, Ad]:
    stmt = (
        select(OrderItem, Ad)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Ad, Ad.id == Order.ad_id)
        .where(Order.company_id == company_id, OrderItem.id == item_id)
    )
    row = (await db.exec(stmt)).first()
    if row is None:
        raise NotFoundError(detail="Order item not found")
    return row  # type: ignore[return-value]


async def _ad_product_ids(db: AsyncSession, *, company_id: uuid.UUID, ad_id: uuid.UUID) -> set[uuid.UUID]:
    return set(
        (
            await db.exec(
                select(AdProduct.product_id).where(AdProduct.ad_id == ad_id, AdProduct.company_id == company_id)
            )
        ).all()
    )


async def _assign_variation(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    item: OrderItem,
    ad: Ad,
    variation_id: uuid.UUID,
) -> None:
    """Validate then set ``item.variation_id`` + write an audit entry.

    The variation must exist for this tenant AND belong to one of the ad's
    products — the same invariant :func:`services.order.create_order` enforces,
    so a mapped item never decrements stock of a product the listing doesn't
    sell. Caller owns the commit.
    """

    variation = (
        await db.exec(
            scoped(select(ProductVariation), ProductVariation, company_id).where(ProductVariation.id == variation_id)
        )
    ).first()
    if variation is None:
        raise ValidationError(detail="Variation not found for this company")

    ad_pids = await _ad_product_ids(db, company_id=company_id, ad_id=ad.id)
    if variation.product_id not in ad_pids:
        raise ValidationError(detail="Variation does not belong to any of the ad's products")

    item.variation_id = variation.id
    # Estampa follows from the product: cache the print code on the item so the
    # Separação screens read it without re-resolving the product.
    product = (
        await db.exec(scoped(select(Product), Product, company_id).where(Product.id == variation.product_id))
    ).first()
    if product is not None and product.print_id is not None:
        design = (
            await db.exec(
                scoped(select(PrintDesign), PrintDesign, company_id).where(PrintDesign.id == product.print_id)
            )
        ).first()
        item.mapped_print = design.code if design else None
    else:
        item.mapped_print = None

    db.add(item)
    await db.flush()
    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=item.order_id,
        message=f"Mapped order item {item.id.hex[:8].upper()} to variation {variation.sku}",
    )


async def accept_suggestion(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    item_id: uuid.UUID,
) -> MappingItem:
    """Accept the system's best suggestion for one pending item."""

    item, ad = await _load_item_with_ad(db, company_id=company_id, item_id=item_id)
    if item.variation_id is not None:
        raise ValidationError(detail="Order item is already mapped")

    ctx = await _build_context(db, company_id=company_id)
    # Re-resolve the variation text from the 1:1 import row (may be absent).
    imported = (
        await db.exec(
            scoped(select(ImportedOrder), ImportedOrder, company_id).where(ImportedOrder.order_id == item.order_id)
        )
    ).first()
    ad_title = (imported.ad_title if imported else None) or ad.title
    variation_text = imported.variation_text if imported else None

    suggestion = _best_suggestion(
        ad_title=ad_title,
        variation_text=variation_text,
        candidates=ctx.candidates_by_ad.get(ad.id, []),
        prints=ctx.prints,
    )
    if suggestion is None:
        raise ValidationError(detail="No unambiguous suggestion for this order item")

    await _assign_variation(
        db,
        company_id=company_id,
        user_id=user_id,
        item=item,
        ad=ad,
        variation_id=suggestion.variation_id,
    )
    await db.commit()
    return await get_item(db, company_id=company_id, item_id=item_id)


async def accept_all(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
) -> AcceptAllResult:
    """Accept every unambiguous suggestion across all pending items."""

    ctx = await _build_context(db, company_id=company_id)

    pending_stmt = (
        _item_select().where(Order.company_id == company_id, OrderItem.variation_id.is_(None))  # type: ignore[union-attr]
    )
    rows = (await db.exec(pending_stmt)).all()

    accepted = 0
    for row in rows:
        item, ad, imported_title, variation_text, _ad_sku = row  # type: ignore[misc]
        ad_title = imported_title or ad.title
        suggestion = _best_suggestion(
            ad_title=ad_title,
            variation_text=variation_text,
            candidates=ctx.candidates_by_ad.get(ad.id, []),
            prints=ctx.prints,
        )
        if suggestion is None:
            continue
        await _assign_variation(
            db,
            company_id=company_id,
            user_id=user_id,
            item=item,
            ad=ad,
            variation_id=suggestion.variation_id,
        )
        accepted += 1

    if accepted:
        await db.commit()
    else:
        await db.rollback()
    return AcceptAllResult(accepted=accepted)


async def set_variation(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    item_id: uuid.UUID,
    variation_id: uuid.UUID,
) -> MappingItem:
    """Manually set (swap) the variation for an item — the De/Para override."""

    item, ad = await _load_item_with_ad(db, company_id=company_id, item_id=item_id)
    await _assign_variation(
        db,
        company_id=company_id,
        user_id=user_id,
        item=item,
        ad=ad,
        variation_id=variation_id,
    )
    await db.commit()
    return await get_item(db, company_id=company_id, item_id=item_id)


async def get_item(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    item_id: uuid.UUID,
) -> MappingItem:
    stmt = _item_select().where(Order.company_id == company_id, OrderItem.id == item_id)
    row = (await db.exec(stmt)).first()
    if row is None:
        raise NotFoundError(detail="Order item not found")
    ctx = await _build_context(db, company_id=company_id)
    return _row_to_item(row, ctx)  # type: ignore[arg-type]


__all__ = [
    "accept_all",
    "accept_suggestion",
    "get_item",
    "list_items",
    "set_variation",
]
