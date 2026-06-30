"""Service layer for the Upseller marketplace order import.

Ports the legacy Base44 ``processarPlanilha`` flow to Orion's stricter
model. A single call parses the Upseller CSV, strict-matches each line
against the tenant catalog (``Ad`` + ``ProductVariation``) and, for every
match, creates a financial :class:`~models.order.Order` (client/price left
NULL — the export carries neither) plus a linked
:class:`~models.imported_order.ImportedOrder` snapshot holding the
marketplace fields (tracking, label, NF-e key, channel, store, …).

Strictness: a row that cannot resolve to exactly one ad **and** exactly
one variation is reported as an error and never persisted. Re-imports are
idempotent on ``(marketplace, platform_order_id, sku)``.

Parsing notes (matching the real export):
- Encoding is Windows-1252; we decode UTF-8 first then fall back.
- Delimiter is ``;``.
- Headers are matched accent-insensitively by stripping every non
  ``[a-z0-9]`` char (so ``"Nº de Pedido da Plataforma"`` → ``ndepedidodaplataforma``).
- ``Variação`` carries colour + size as free text (``"0391-AZUL,G"``,
  ``"P,Preto,Eis Me Aqui"``, ``"Preto-G"``); :func:`_extract_color_size`
  teases them apart.
- ``ordered_at`` has no column — it is derived from the date embedded in
  every shipping-label URL (``…/pdf-cache/2026-05-18/…``).
"""

from __future__ import annotations

import csv
import io
import re
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Ad, AdProduct, Ecommerce, ImportedOrder, Order, OrderStatus, ProductVariation, Size, SkuMapping
from schemas.imported_orders import UpsellerImportError, UpsellerImportSummary
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ValidationError

_RESOURCE = "orders"
_MAX_CSV_BYTES = 5 * 1024 * 1024


def _decode_bytes(data: bytes) -> str:
    """Decode CSV bytes, trying UTF-8 variants before falling back to latin-1.

    The Upseller export is Windows-1252; ``latin-1`` never raises and maps the
    accented bytes the file actually uses, so it is the safe final fallback.
    """

    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    # Last resort — replace errors so we don't blow up.
    return data.decode("utf-8", errors="replace")


# --------------------------------------------------------------- header mapping


# Normalized (lowercased, non-alphanumerics stripped) header → internal field.
# Accented characters are dropped by the stripping, so "Anúncio" → "anncio".
_HEADER_MAP: dict[str, str] = {
    # platform order id
    "ndepedidodaplataforma": "platform_order_id",
    "npedidodaplataforma": "platform_order_id",
    "numeropedidoplataforma": "platform_order_id",
    "pedidoplataforma": "platform_order_id",
    # upseller order number
    "ndepedido": "upseller_order_no",
    "numeropedido": "upseller_order_no",
    "pedido": "upseller_order_no",
    # marketplace / channel
    "plataformas": "marketplace",
    "plataforma": "marketplace",
    "marketplace": "marketplace",
    "canal": "marketplace",
    # store
    "nomedalojanoupseller": "store_name",
    "nomedaloja": "store_name",
    "loja": "store_name",
    # ad title
    "nomedoanncio": "ad_title",
    "nomedoanuncio": "ad_title",
    "anncio": "ad_title",
    "anuncio": "ad_title",
    "titulodoanuncio": "ad_title",
    "titulo": "ad_title",
    "produto": "ad_title",
    "nome": "ad_title",
    # sku
    "sku": "sku",
    # variation
    "variao": "variation_text",
    "variacao": "variation_text",
    "variacaoproduto": "variation_text",
    "variantes": "variation_text",
    # image
    "linkdaimagem": "image_url",
    "linkimagem": "image_url",
    "imagem": "image_url",
    "image": "image_url",
    "foto": "image_url",
    "fotoproduto": "image_url",
    # quantity
    "qtddoproduto": "quantity",
    "quantidade": "quantity",
    "qtd": "quantity",
    "qty": "quantity",
    "qtde": "quantity",
    # tracking
    "nderastreio": "tracking_code",
    "nrastreio": "tracking_code",
    "rastreio": "tracking_code",
    "codigorastreio": "tracking_code",
    "tracking": "tracking_code",
    # shipping label
    "etiqueta": "shipping_label_url",
    "urletiqueta": "shipping_label_url",
    "etiquetapdf": "shipping_label_url",
    "linkdaetiqueta": "shipping_label_url",
    "linketiqueta": "shipping_label_url",
    # NF-e access key
    "chavedanotafiscal": "invoice_key",
    "chavenfe": "invoice_key",
    "chavenf": "invoice_key",
    "chavedeacesso": "invoice_key",
    "notafiscal": "invoice_key",
    "nfe": "invoice_key",
}

# Size tokens recognised inside the free-text Variação field.
_SIZE_TOKENS = {
    "pp",
    "p",
    "m",
    "g",
    "gg",
    "xg",
    "xxg",
    "xgg",
    "eg",
    "eeg",
    "3g",
    "4g",
    "xs",
    "s",
    "l",
    "xl",
    "xxl",
    "xxxl",
    "unico",
    "44",
    "46",
    "48",
    "50",
    "52",
    "54",
}

# Raw export label → Ecommerce. Substring keyword match (handles "Mercado
# Libre"/"Mercado Livre", "TikTok Shop", …); anything unrecognized folds to
# OTHER, so a marketplace is *always* a valid enum member — never free text.
_MARKETPLACE_KEYWORDS: tuple[tuple[str, Ecommerce], ...] = (
    ("shopee", Ecommerce.SHOPEE),
    ("mercado", Ecommerce.MERCADO_LIVRE),  # "Mercado Livre" / "Mercado Libre"
    ("shein", Ecommerce.SHEIN),
    ("tiktok", Ecommerce.TIKTOK_SHOP),
    ("tik tok", Ecommerce.TIKTOK_SHOP),
    ("shopify", Ecommerce.SHOPIFY),
    ("instagram", Ecommerce.INSTAGRAM),
    ("whats", Ecommerce.WHATSAPP),
)


def _parse_marketplace(raw: str) -> Ecommerce:
    """Fold a raw export label to its Ecommerce member (default OTHER)."""

    folded = _norm_title(raw)
    for keyword, channel in _MARKETPLACE_KEYWORDS:
        if keyword in folded:
            return channel
    return Ecommerce.OTHER


def _normalize_header(raw: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (raw or "").strip().lower())


def _ascii_fold(value: str) -> str:
    nfkd = unicodedata.normalize("NFKD", value or "")
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _norm_token(value: str) -> str:
    """Lowercase, accent-fold, drop every non-alphanumeric char."""

    return re.sub(r"[^a-z0-9]", "", _ascii_fold(value).lower())


def _norm_title(value: str) -> str:
    folded = re.sub(r"\s+", " ", _ascii_fold(value).lower()).strip()
    return folded


def _remove_sizes_from_title(title: str) -> str:
    return " ".join(w for w in title.split() if _norm_token(w) not in _SIZE_TOKENS)


def _coerce_qty(value: str | None) -> int:
    if not value:
        return 1
    try:
        return max(1, int(float(value.strip().replace(",", "."))))
    except ValueError, TypeError:
        return 1


# Marketplace size spellings Orion models as a single Size member.
_SIZE_ALIASES: dict[str, Size] = {
    "unico": Size.U,
    "u": Size.U,
}


def _to_size(value: str | None) -> Size | None:
    if not value:
        return None
    token = _norm_token(value)
    if token in _SIZE_ALIASES:
        return _SIZE_ALIASES[token]
    try:
        return Size(token)
    except ValueError:
        return None


def _extract_color_size(variacao: str | None) -> tuple[str | None, str | None]:
    """Split a free-text Variação into (color, size).

    Handles the three observed shapes:
        "0391-AZUL,G"          -> ("0391-AZUL", "G")
        "P,Preto,Eis Me Aqui"  -> ("Preto", "P")
        "Preto-G"              -> ("Preto-G", None)   (no separator to split)
    """

    if not variacao:
        return None, None
    parts = [p.strip() for p in re.split(r"[;,]", variacao) if p.strip()]
    color = ""
    size = ""
    for part in parts:
        match = re.match(r"^(cor|color|colour|c|variacao|tam|tamanho|size|t|s)[:=\s]+(.+)$", part, re.I)
        if match:
            key = match.group(1).lower()
            val = match.group(2).strip()
            if key in {"cor", "color", "colour", "c", "variacao"}:
                color = val
            else:
                size = val
            continue
        if _norm_token(part) in _SIZE_TOKENS:
            size = part
        elif not color:
            color = part
    if not color and not size and len(parts) == 1:
        color = parts[0]
    return (color or None), (size or None)


def _variation_tokens(variation_text: str | None) -> tuple[Size | None, set[str]]:
    """Split a free-text Variação into (size, colour/print token bag).

    Order-insensitive: the marketplace emits the variation tokens in any order
    (``"Bege,NY,M"`` == ``"NY,Bege,M"`` == ``"M,NY,Bege"``) and may slip a print
    name in among them (``"Preto,Naruto 03,GG"``). We pull the one size token and
    return the rest as an unordered set of normalized tokens, so matching never
    depends on which slot a colour landed in.
    """

    if not variation_text:
        return None, set()
    parts = [p.strip() for p in re.split(r"[;,·]", variation_text) if p.strip()]
    size: Size | None = None
    tokens: set[str] = set()
    for part in parts:
        match = re.match(r"^(cor|color|colour|c|variacao|tam|tamanho|size|t)[:=\s]+(.+)$", part, re.I)
        key = match.group(1).lower() if match else None
        value = match.group(2).strip() if match else part
        token = _norm_token(value)
        if key in {"tam", "tamanho", "size", "t"}:
            size = _to_size(value) or size
            continue
        if key in {"cor", "color", "colour", "c", "variacao"}:
            if token:
                tokens.add(token)
            continue
        # Unlabeled: a size token is consumed as the size; everything else is a
        # colour/print candidate (we never positionally guess which is colour).
        if size is None and token in _SIZE_TOKENS:
            mapped = _to_size(value)
            if mapped is not None:
                size = mapped
                continue
            # Recognized size spelling Orion doesn't model (PP, XG, …): drop it
            # from the colour bag but leave size unresolved.
            continue
        if token:
            tokens.add(token)
    return size, tokens


def _color_in_tokens(variation: ProductVariation, tokens: set[str]) -> bool:
    """True if the variation's colour/colour-code matches any candidate token."""

    if not tokens:
        return True
    for candidate in (_norm_token(variation.color), _norm_token(variation.color_code)):
        if not candidate:
            continue
        for token in tokens:
            if candidate == token or candidate in token or token in candidate:
                return True
    return False


def _cell(raw: list[str], columns: dict[str, int], field: str) -> str | None:
    idx = columns.get(field)
    if idx is None or idx >= len(raw):
        return None
    value = (raw[idx] or "").strip()
    return value or None


@dataclass(slots=True)
class _ParsedRow:
    row_index: int
    platform_order_id: str
    upseller_order_no: str | None
    marketplace: str
    store_name: str | None
    ad_title: str
    sku: str
    variation_text: str | None
    color: str | None
    size: str | None
    quantity: int
    image_url: str | None
    tracking_code: str | None
    shipping_label_url: str | None
    invoice_key: str | None


def parse_upseller_csv(file_bytes: bytes) -> list[_ParsedRow]:
    """Parse the Upseller CSV. Raises ``ValidationError`` on bad input."""

    if not file_bytes:
        raise ValidationError(detail="Empty CSV file")
    if len(file_bytes) > _MAX_CSV_BYTES:
        raise ValidationError(detail="CSV exceeds 5MB limit")

    text = _decode_bytes(file_bytes)
    first_line = text.split("\n", 1)[0]
    delimiter = ";" if ";" in first_line else ","
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    all_rows = [row for row in reader if any((c or "").strip() for c in row)]
    if len(all_rows) < 2:
        raise ValidationError(detail="CSV has no data rows")

    headers = [_normalize_header(h) for h in all_rows[0]]
    columns: dict[str, int] = {}
    for idx, header in enumerate(headers):
        field = _HEADER_MAP.get(header)
        if field and field not in columns:
            columns[field] = idx

    if not {"ad_title", "quantity", "marketplace"} <= columns.keys():
        raise ValidationError(
            detail="Unrecognized CSV — expected an Upseller order export "
            "(missing the ad name, quantity or marketplace columns)"
        )

    rows: list[_ParsedRow] = []
    for offset, raw in enumerate(all_rows[1:]):
        ad_title = _cell(raw, columns, "ad_title")
        if not ad_title:
            # Mirror the legacy importer: a line with no ad title is junk.
            continue
        variation_text = _cell(raw, columns, "variation_text")
        color, size = _extract_color_size(variation_text)
        rows.append(
            _ParsedRow(
                row_index=offset,
                platform_order_id=_cell(raw, columns, "platform_order_id") or "",
                upseller_order_no=_cell(raw, columns, "upseller_order_no"),
                marketplace=_cell(raw, columns, "marketplace") or "",
                store_name=_cell(raw, columns, "store_name"),
                ad_title=ad_title,
                sku=_cell(raw, columns, "sku") or "",
                variation_text=variation_text,
                color=color,
                size=size,
                quantity=_coerce_qty(_cell(raw, columns, "quantity")),
                image_url=_cell(raw, columns, "image_url"),
                tracking_code=_cell(raw, columns, "tracking_code"),
                shipping_label_url=_cell(raw, columns, "shipping_label_url"),
                invoice_key=_cell(raw, columns, "invoice_key"),
            )
        )

    if not rows:
        raise ValidationError(detail="CSV contained no usable rows")
    return rows


def _derive_ordered_at(row: _ParsedRow, *, now: datetime) -> datetime:
    """Derive an order date: shipping-label URL date → order-id YYMMDD → now."""

    if row.shipping_label_url:
        match = re.search(r"(\d{4})-(\d{2})-(\d{2})", row.shipping_label_url)
        if match:
            try:
                return datetime(int(match[1]), int(match[2]), int(match[3]), tzinfo=UTC)
            except ValueError:
                pass
    pid = row.platform_order_id
    if pid and len(pid) >= 6 and pid[:6].isdigit():
        yy, mm, dd = int(pid[0:2]), int(pid[2:4]), int(pid[4:6])
        try:
            return datetime(2000 + yy, mm, dd, tzinfo=UTC)
        except ValueError:
            pass
    return now


# ----------------------------------------------------------- catalog resolution


@dataclass(slots=True)
class _ResolveContext:
    ads: list[Ad]
    ads_by_id: dict[uuid.UUID, Ad]
    ads_by_external: dict[str, Ad]
    variations_by_id: dict[uuid.UUID, ProductVariation]
    variations_by_product: dict[uuid.UUID, list[ProductVariation]]
    ad_product_ids: dict[uuid.UUID, list[uuid.UUID]]
    # (marketplace value, normalized sku) → (ad_id, variation_id) — the De/Para.
    sku_mappings: dict[tuple[str, str], tuple[uuid.UUID, uuid.UUID]]


async def _build_resolve_context(db: AsyncSession, *, company_id: uuid.UUID) -> _ResolveContext:
    ads = list((await db.exec(scoped(select(Ad), Ad, company_id))).all())
    ads_by_id = {ad.id: ad for ad in ads}
    ads_by_external = {ad.external_id.strip().lower(): ad for ad in ads if ad.external_id}

    variations = list((await db.exec(scoped(select(ProductVariation), ProductVariation, company_id))).all())
    variations_by_id = {v.id: v for v in variations}
    by_product: dict[uuid.UUID, list[ProductVariation]] = {}
    for variation in variations:
        by_product.setdefault(variation.product_id, []).append(variation)

    ad_product_ids: dict[uuid.UUID, list[uuid.UUID]] = {}
    for ad_id, product_id in (
        await db.exec(select(AdProduct.ad_id, AdProduct.product_id).where(AdProduct.company_id == company_id))
    ).all():
        ad_product_ids.setdefault(ad_id, []).append(product_id)

    sku_mappings: dict[tuple[str, str], tuple[uuid.UUID, uuid.UUID]] = {}
    for mapping in (await db.exec(scoped(select(SkuMapping), SkuMapping, company_id))).all():
        sku_mappings[(mapping.marketplace.value, mapping.sku.strip().lower())] = (mapping.ad_id, mapping.variation_id)

    return _ResolveContext(
        ads=ads,
        ads_by_id=ads_by_id,
        ads_by_external=ads_by_external,
        variations_by_id=variations_by_id,
        variations_by_product=by_product,
        ad_product_ids=ad_product_ids,
        sku_mappings=sku_mappings,
    )


def _resolve_from_mapping(
    ctx: _ResolveContext, *, marketplace: Ecommerce, row: _ParsedRow
) -> tuple[Ad, ProductVariation] | None:
    """SKU-first De/Para lookup: a once-resolved SKU resolves deterministically.

    Returns the stored (ad, variation) when both still exist for this tenant and
    the variation belongs to one of the ad's products; otherwise None, so the
    caller falls back to fuzzy matching (a stale mapping never blocks an import).
    """

    sku = (row.sku or "").strip().lower()
    if not sku:
        return None
    hit = ctx.sku_mappings.get((marketplace.value, sku))
    if hit is None:
        return None
    ad = ctx.ads_by_id.get(hit[0])
    variation = ctx.variations_by_id.get(hit[1])
    if ad is None or variation is None:
        return None
    if variation.product_id not in set(ctx.ad_product_ids.get(ad.id, [])):
        return None
    return ad, variation


def _channel_of(marketplace: str) -> Ecommerce | None:
    """The channel an ad match can be narrowed by — OTHER never constrains."""

    channel = _parse_marketplace(marketplace)
    return channel if channel is not Ecommerce.OTHER else None


def _resolve_ad(ctx: _ResolveContext, row: _ParsedRow) -> tuple[Ad | None, str | None]:
    """Strict ad match by external id (listing) or title. Ambiguity is rejected."""

    sku = row.sku.strip().lower()
    listing = sku.split("-", 1)[0] if sku else ""
    matched: dict[uuid.UUID, Ad] = {}
    for key in {sku, listing} - {""}:
        ad = ctx.ads_by_external.get(key)
        if ad is not None:
            matched[ad.id] = ad

    if not matched:
        title = _norm_title(row.ad_title)
        title_nt = _remove_sizes_from_title(title)
        if title:
            for ad in ctx.ads:
                cand = _norm_title(ad.title)
                cand_nt = _remove_sizes_from_title(cand)
                if (
                    title == cand
                    or title in cand
                    or cand in title
                    or (cand_nt and (title_nt == cand_nt or title_nt in cand_nt or cand_nt in title_nt))
                ):
                    matched[ad.id] = ad

    candidates = list(matched.values())
    channel = _channel_of(row.marketplace)
    if channel is not None and len(candidates) > 1:
        narrowed = [ad for ad in candidates if ad.ecommerce == channel]
        if narrowed:
            candidates = narrowed

    if not candidates:
        return None, "no matching ad for title/SKU"
    if len(candidates) > 1:
        return None, "ambiguous ad match"
    return candidates[0], None


def _sku_matches(variation_sku: str, row_sku: str) -> bool:
    a, b = variation_sku.strip().lower(), row_sku.strip().lower()
    if not a or not b:
        return False
    return a == b or a.startswith(b) or b.startswith(a)


def _resolve_variation(ctx: _ResolveContext, ad: Ad, row: _ParsedRow) -> tuple[ProductVariation | None, str | None]:
    """Strict variation match within the ad's product. Ambiguity is rejected."""

    variations = [v for pid in ctx.ad_product_ids.get(ad.id, []) for v in ctx.variations_by_product.get(pid, [])]
    if not variations:
        return None, "ad has no product variations"

    if row.sku:
        sku_hits = [v for v in variations if v.sku and _sku_matches(v.sku, row.sku)]
        if len(sku_hits) == 1:
            return sku_hits[0], None
        if len(sku_hits) > 1:
            return None, "ambiguous variation match (SKU)"

    # Order-insensitive size + colour token match over the variation text.
    size, color_tokens = _variation_tokens(row.variation_text)
    pool = [v for v in variations if v.size == size] if size is not None else list(variations)
    hits = [v for v in pool if _color_in_tokens(v, color_tokens)]

    if len(hits) == 1:
        return hits[0], None
    if not hits:
        return None, "no matching variation for size/color"
    return None, "ambiguous variation match (size/color)"


# --------------------------------------------------------------------- import


async def _existing_import_keys(db: AsyncSession, *, company_id: uuid.UUID) -> set[tuple[str, str, str]]:
    stmt = scoped(
        select(ImportedOrder.marketplace, ImportedOrder.platform_order_id, ImportedOrder.sku),
        ImportedOrder,
        company_id,
    )
    return {
        (str(marketplace), platform_order_id.strip(), sku.strip())
        for marketplace, platform_order_id, sku in (await db.exec(stmt)).all()
    }


def _dedup_key(marketplace: Ecommerce, row: _ParsedRow) -> tuple[str, str, str]:
    return (marketplace.value, row.platform_order_id.strip(), row.sku.strip())


def _row_error(row: _ParsedRow, marketplace: Ecommerce, message: str) -> UpsellerImportError:
    """Build an unmatched-line error rich enough for the import resolver UI."""

    return UpsellerImportError(
        row_index=row.row_index,
        message=message,
        marketplace=marketplace,
        platform_order_id=row.platform_order_id or None,
        sku=row.sku or None,
        ad_title=row.ad_title or None,
        variation_text=row.variation_text or None,
        image_url=row.image_url or None,
    )


async def _store_auto_mapping(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    marketplace: Ecommerce,
    sku: str,
    ad_id: uuid.UUID,
    variation_id: uuid.UUID,
) -> bool:
    """Learn a ``(marketplace, sku) → (ad, variation)`` mapping from a match.

    Isolated in its own savepoint so the unique-key constraint firing (a race,
    or a key created earlier this run) never rolls back the order it was learned
    from. Never overwrites an existing mapping — a human's manual pin stays
    authoritative. Returns ``True`` when a new mapping was written.
    """

    try:
        async with db.begin_nested():
            db.add(
                SkuMapping(
                    company_id=company_id,
                    marketplace=marketplace,
                    sku=sku,
                    ad_id=ad_id,
                    variation_id=variation_id,
                    source="auto",
                    created_by=user_id,
                )
            )
            await db.flush()
        return True
    except IntegrityError:
        return False


async def import_upseller_orders(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    file_bytes: bytes,
    dry_run: bool = False,
) -> UpsellerImportSummary:
    """Parse + strict-match + (unless ``dry_run``) persist Upseller orders."""

    rows = parse_upseller_csv(file_bytes)
    ctx = await _build_resolve_context(db, company_id=company_id)
    existing = await _existing_import_keys(db, company_id=company_id)
    now = datetime.now(tz=UTC)

    created = 0
    skipped = 0
    errors: list[UpsellerImportError] = []
    seen: set[tuple[str, str, str]] = set()
    # (marketplace value, normalized sku) learned from fuzzy matches this run.
    auto_seen: set[tuple[str, str]] = set()

    for row in rows:
        marketplace = _parse_marketplace(row.marketplace)
        key = _dedup_key(marketplace, row)
        if key in existing or key in seen:
            skipped += 1
            continue

        # SKU-first: a previously-resolved marketplace SKU resolves both the ad
        # and the variation deterministically — never re-guessed, never ambiguous.
        mapped = _resolve_from_mapping(ctx, marketplace=marketplace, row=row)
        if mapped is not None:
            ad, variation = mapped
        else:
            ad, ad_error = _resolve_ad(ctx, row)
            if ad is None:
                errors.append(_row_error(row, marketplace, ad_error or "ad not resolved"))
                continue

            variation, var_error = _resolve_variation(ctx, ad, row)
            if variation is None:
                errors.append(_row_error(row, marketplace, var_error or "variation not resolved"))
                continue

        if dry_run:
            created += 1
            seen.add(key)
            continue

        try:
            async with db.begin_nested():
                order = Order(
                    company_id=company_id,
                    ad_id=ad.id,
                    variation_id=variation.id,
                    client_id=None,
                    sale_price=None,
                    quantity=row.quantity,
                    ordered_at=_derive_ordered_at(row, now=now),
                    external_order_id=row.platform_order_id or None,
                    status=OrderStatus.PENDING,
                )
                db.add(order)
                await db.flush()
                db.add(
                    ImportedOrder(
                        company_id=company_id,
                        order_id=order.id,
                        source="upseller",
                        marketplace=marketplace,
                        store_name=row.store_name,
                        platform_order_id=row.platform_order_id,
                        upseller_order_no=row.upseller_order_no,
                        ad_title=row.ad_title,
                        sku=row.sku,
                        variation_text=row.variation_text,
                        color=row.color,
                        size=row.size,
                        quantity=row.quantity,
                        image_url=row.image_url,
                        tracking_code=row.tracking_code,
                        shipping_label_url=row.shipping_label_url,
                        invoice_key=row.invoice_key,
                    )
                )
                await db.flush()
        except IntegrityError:
            # The (ad, variation, external_order_id) or import-key unique
            # constraint fired — treat as a duplicate line, not a hard failure.
            skipped += 1
            continue

        await write_audit(
            db,
            company_id=company_id,
            user_id=user_id,
            resource_type=_RESOURCE,
            resource_id=order.id,
            message=f"Imported order ORD-{order.id.hex[:8].upper()} from {marketplace.value}",
        )
        created += 1
        seen.add(key)

        # Learn the resolution: a fuzzy-matched SKU becomes a stored mapping so
        # the next import resolves it deterministically. Skip lines that already
        # came from the De/Para (mapped) or whose SKU is already known.
        if mapped is None and row.sku:
            mkey = (marketplace.value, row.sku.strip().lower())
            if (
                mkey not in ctx.sku_mappings
                and mkey not in auto_seen
                and await _store_auto_mapping(
                    db,
                    company_id=company_id,
                    user_id=user_id,
                    marketplace=marketplace,
                    sku=mkey[1],
                    ad_id=ad.id,
                    variation_id=variation.id,
                )
            ):
                auto_seen.add(mkey)

    if not dry_run:
        if created:
            await db.commit()
        else:
            await db.rollback()

    return UpsellerImportSummary(
        total=len(rows),
        created=created,
        skipped_duplicates=skipped,
        errors=errors,
        dry_run=dry_run,
    )


__all__ = [
    "import_upseller_orders",
    "parse_upseller_csv",
]
