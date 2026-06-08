"""Service layer for FEATURE-014 — LLM-powered orders import.

Two responsibilities:

- **Parse** a file (CSV or PDF) into a list of :class:`ParsedOrderRow`
  with a per-row confidence in ``[0, 1]``.
- **Commit** a (potentially user-edited) list of rows by resolving each
  row's client + ad + variation against the tenant's catalog and
  creating an :class:`Order` (plus an audit-log entry).

CSV parsing uses ``csv.Sniffer`` + a header-synonym map covering the
most common English and pt-BR column names. Confidence is set to
``1.0`` for headers we recognise, since the mapping is deterministic.

PDF parsing extracts text with ``pypdf`` and then calls the Anthropic
Messages API with a structured-output prompt. The response is required
to be a JSON array of order entries. If validation fails the service
retries **once** with a corrective prompt that quotes the validation
error back at the model. After two failures we raise ``ValidationError``
so the router can surface a 422.

The Anthropic SDK is patched in tests by intercepting the HTTPS endpoint
via ``respx`` — the real network is never touched.
"""

from __future__ import annotations

import csv
import io
import json
import re
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from dateutil import parser as date_parser
from pypdf import PdfReader
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from config import config
from models import (
    Ad,
    AdProduct,
    Client,
    Order,
    OrderStatus,
    Product,
    ProductVariation,
    Size,
)
from schemas.orders_import import (
    CommitOrderError,
    CommitOrdersBody,
    CommitOrdersResponse,
    ImportFormat,
    ParsedOrderRow,
    ParseResponse,
)
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import ValidationError

_RESOURCE = "orders"
_MAX_PDF_BYTES = 5 * 1024 * 1024  # 5MB — keep the LLM call cheap.
_MAX_CSV_BYTES = 5 * 1024 * 1024
_PDF_TEXT_LIMIT = 18_000  # chars passed to the LLM


# --------------------------------------------------------------- CSV parsing


# Header synonyms. Lowercased, accent-stripped lookup.
_HEADER_MAP: dict[str, str] = {
    # client name
    "client": "client_name",
    "client_name": "client_name",
    "customer": "client_name",
    "customer_name": "client_name",
    "buyer": "client_name",
    "name": "client_name",
    "cliente": "client_name",
    "nome": "client_name",
    "comprador": "client_name",
    "destinatario": "client_name",
    # email
    "email": "client_email",
    "e-mail": "client_email",
    "e_mail": "client_email",
    "mail": "client_email",
    # phone
    "phone": "client_phone",
    "telephone": "client_phone",
    "phone_number": "client_phone",
    "telefone": "client_phone",
    "celular": "client_phone",
    "fone": "client_phone",
    # ad
    "ad": "ad_external_id",
    "ad_id": "ad_external_id",
    "ad_external_id": "ad_external_id",
    "external_ad_id": "ad_external_id",
    "channel_ad_id": "ad_external_id",
    "listing": "ad_external_id",
    "listing_id": "ad_external_id",
    "anuncio": "ad_external_id",
    "id_anuncio": "ad_external_id",
    # product
    "product": "product_hint",
    "produto": "product_hint",
    "item": "product_hint",
    "sku": "product_hint",
    "variation": "product_hint",
    "variacao": "product_hint",
    "description": "product_hint",
    "descricao": "product_hint",
    # quantity
    "qty": "quantity",
    "quantity": "quantity",
    "qtd": "quantity",
    "quantidade": "quantity",
    # price
    "price": "sale_price",
    "sale_price": "sale_price",
    "unit_price": "sale_price",
    "value": "sale_price",
    "amount": "sale_price",
    "preco": "sale_price",
    "preço": "sale_price",
    "valor": "sale_price",
    "valor_unitario": "sale_price",
    # date
    "date": "ordered_at",
    "order_date": "ordered_at",
    "ordered_at": "ordered_at",
    "data": "ordered_at",
    "data_pedido": "ordered_at",
}


def _normalize_header(raw: str) -> str:
    cleaned = raw.strip().lower()
    cleaned = (
        cleaned.replace("ã", "a")
        .replace("á", "a")
        .replace("â", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("ú", "u")
        .replace("ç", "c")
    )
    cleaned = re.sub(r"[\s\-]+", "_", cleaned)
    cleaned = re.sub(r"[^a-z0-9_]", "", cleaned)
    return cleaned


def _decode_bytes(data: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    # Last resort — replace errors so we don't blow up.
    return data.decode("utf-8", errors="replace")


def _coerce_int(value: str | None) -> int | None:
    if value is None or not value.strip():
        return None
    try:
        return int(float(value.strip().replace(",", ".")))
    except ValueError:
        return None


def _coerce_decimal(value: str | None) -> Decimal | None:
    if value is None or not value.strip():
        return None
    raw = value.strip().replace("R$", "").replace(" ", "")
    # Treat "1.234,56" as pt-BR thousand-sep + comma decimal.
    if "," in raw and raw.count(",") == 1 and raw.rfind(",") > raw.rfind("."):
        raw = raw.replace(".", "").replace(",", ".")
    raw = raw.replace(",", "")
    try:
        return Decimal(raw).quantize(Decimal("0.01"))
    except InvalidOperation, ValueError:
        return None


def _coerce_datetime(value: str | None) -> datetime | None:
    if value is None or not value.strip():
        return None
    try:
        return date_parser.parse(value.strip(), dayfirst=True)
    except ValueError, OverflowError:
        return None


async def parse_csv(file_bytes: bytes) -> ParseResponse:
    """Parse a CSV file. Raises ``ValidationError`` for unrecognised input."""

    if not file_bytes:
        raise ValidationError(detail="Empty CSV file")
    if len(file_bytes) > _MAX_CSV_BYTES:
        raise ValidationError(detail="CSV exceeds 5MB limit")

    text = _decode_bytes(file_bytes)
    # Sniff dialect; default to comma + double-quote when sniffing fails.
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel  # type: ignore[assignment]

    reader = csv.reader(io.StringIO(text), dialect=dialect)
    rows = list(reader)
    if not rows:
        raise ValidationError(detail="No rows found in CSV")

    header_raw = rows[0]
    headers = [_normalize_header(h) for h in header_raw]
    field_columns: dict[str, int] = {}
    for idx, header in enumerate(headers):
        target = _HEADER_MAP.get(header)
        if target and target not in field_columns:
            field_columns[target] = idx

    # Must recognise at least one of the "essential" fields, otherwise
    # we cannot build a useful row.
    essential = {"client_name", "product_hint", "quantity", "sale_price"}
    if not essential.intersection(field_columns.keys()):
        raise ValidationError(detail="Could not detect any known columns in the CSV header row")

    parsed: list[ParsedOrderRow] = []

    def _cell(row: list[str], field: str) -> str | None:
        col = field_columns.get(field)
        if col is None or col >= len(row):
            return None
        value = row[col].strip()
        return value or None

    excerpt_limit = 200
    for row_index, raw_row in enumerate(rows[1:]):
        if not raw_row or all(not str(c).strip() for c in raw_row):
            continue
        excerpt = ",".join(c.strip() for c in raw_row)[:excerpt_limit]
        parsed.append(
            ParsedOrderRow(
                row_index=row_index,
                confidence=1.0,
                client_name=_cell(raw_row, "client_name"),
                client_email=_cell(raw_row, "client_email"),
                client_phone=_cell(raw_row, "client_phone"),
                ad_external_id=_cell(raw_row, "ad_external_id"),
                product_hint=_cell(raw_row, "product_hint"),
                quantity=_coerce_int(_cell(raw_row, "quantity")),
                sale_price=_coerce_decimal(_cell(raw_row, "sale_price")),
                ordered_at=_coerce_datetime(_cell(raw_row, "ordered_at")),
                raw_excerpt=excerpt or None,
            )
        )

    if not parsed:
        raise ValidationError(detail="CSV contained no data rows")

    return ParseResponse(rows=parsed, notes=None)


# --------------------------------------------------------------- PDF parsing


_PDF_SYSTEM_PROMPT = (
    "You extract orders from order receipts. Respond with VALID JSON ONLY — "
    "no markdown, no commentary. The JSON shape is: "
    '{"orders": [{"client_name": string|null, "client_email": string|null, '
    '"client_phone": string|null, "ad_external_id": string|null, '
    '"product_hint": string|null, "quantity": int|null, "sale_price": '
    'string|null (decimal "0.00"), "ordered_at": string|null (ISO 8601), '
    '"raw_excerpt": string|null, "confidence": number 0..1}], '
    '"notes": string|null}. '
    "Confidence reflects how clearly each row was identified - favour 0.9+ "
    "for clean rows, 0.5-0.8 when fields are ambiguous, <0.5 when guessing."
)

_USER_PROMPT = "Extract orders from this receipt. Return JSON only.\n\n---\n{text}\n---"

_CORRECTIVE_PROMPT = (
    "Your previous response was not valid against the expected schema. "
    "Validation error: {error}. Re-emit STRICT JSON only, matching the "
    "schema described in the system prompt."
)


def _extract_pdf_text(file_bytes: bytes) -> str:
    if not file_bytes:
        raise ValidationError(detail="Empty PDF file")
    if len(file_bytes) > _MAX_PDF_BYTES:
        raise ValidationError(detail="PDF exceeds 5MB limit")
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except Exception as exc:
        raise ValidationError(detail="Could not open the PDF file") from exc

    parts: list[str] = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            # Skip pages we cannot decode rather than aborting the whole file.
            continue
    text = "\n".join(parts).strip()
    if not text:
        raise ValidationError(detail="PDF contained no extractable text")
    return text[:_PDF_TEXT_LIMIT]


def _extract_text_from_message(message: Any) -> str:
    """Pluck the textual content from an Anthropic Message response."""

    blocks = getattr(message, "content", None) or []
    parts: list[str] = []
    for block in blocks:
        text = getattr(block, "text", None)
        if isinstance(text, str):
            parts.append(text)
            continue
        if isinstance(block, dict):
            text_value = block.get("text")
            if isinstance(text_value, str):
                parts.append(text_value)
    return "".join(parts).strip()


def _strip_code_fences(text: str) -> str:
    """LLMs sometimes wrap JSON in ```json … ``` — strip if present."""

    stripped = text.strip()
    if stripped.startswith("```"):
        # Drop the opening fence (with or without a language tag) and the
        # closing fence, if any.
        stripped = re.sub(r"^```[a-zA-Z]*\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    return stripped.strip()


def _coerce_llm_row(raw: dict[str, Any], fallback_index: int) -> ParsedOrderRow:
    """Coerce one LLM-emitted dict into a :class:`ParsedOrderRow`.

    LLM output is permissive (string vs int vs null) — we normalise the
    obvious typings rather than failing the whole batch on a single quirk.
    Pydantic still validates the final shape, so anything truly broken is
    surfaced via the schema-validation retry path.
    """

    def _opt_str(key: str) -> str | None:
        value = raw.get(key)
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    confidence_raw = raw.get("confidence")
    try:
        confidence = float(confidence_raw) if confidence_raw is not None else 0.8
    except ValueError, TypeError:
        confidence = 0.8
    confidence = max(0.0, min(1.0, confidence))

    quantity_raw = raw.get("quantity")
    try:
        quantity = int(quantity_raw) if quantity_raw is not None else None
    except ValueError, TypeError:
        quantity = None
    if quantity is not None and quantity < 1:
        quantity = None

    price_raw = raw.get("sale_price")
    sale_price = _coerce_decimal(str(price_raw)) if price_raw is not None else None

    return ParsedOrderRow(
        row_index=int(raw.get("row_index", fallback_index)),
        confidence=confidence,
        client_name=_opt_str("client_name"),
        client_email=_opt_str("client_email"),
        client_phone=_opt_str("client_phone"),
        ad_external_id=_opt_str("ad_external_id"),
        product_hint=_opt_str("product_hint"),
        quantity=quantity,
        sale_price=sale_price,
        ordered_at=_coerce_datetime(_opt_str("ordered_at")),
        raw_excerpt=_opt_str("raw_excerpt"),
    )


def _parse_llm_payload(payload: str) -> tuple[list[ParsedOrderRow], str | None]:
    """Validate and coerce an LLM JSON payload into ``(rows, notes)``."""

    cleaned = _strip_code_fences(payload)
    if not cleaned:
        raise ValueError("empty payload")
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON: {exc.msg}") from exc

    if not isinstance(data, dict):
        raise ValueError("expected JSON object at top level")
    orders = data.get("orders")
    if not isinstance(orders, list):
        raise ValueError("'orders' must be an array")
    if not orders:
        raise ValueError("'orders' array is empty")

    rows: list[ParsedOrderRow] = []
    for idx, raw in enumerate(orders):
        if not isinstance(raw, dict):
            raise ValueError(f"row {idx} is not an object")
        rows.append(_coerce_llm_row(raw, idx))
    notes = data.get("notes") if isinstance(data.get("notes"), str) else None
    return rows, notes


def _anthropic_client():
    """Build an :class:`anthropic.AsyncAnthropic` client.

    Imported lazily so the SDK is only loaded when needed and so the test
    suite can monkey-patch this factory. ``respx`` patches the HTTPS
    layer below.
    """

    if not config.ANTHROPIC_API_KEY:
        raise ValidationError(detail="Anthropic API key is not configured. Set ANTHROPIC_API_KEY.")
    from anthropic import AsyncAnthropic

    return AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)


async def _call_llm(messages: list[dict[str, Any]]) -> str:
    client = _anthropic_client()
    response = await client.messages.create(
        model=config.ANTHROPIC_MODEL,
        max_tokens=1500,
        system=_PDF_SYSTEM_PROMPT,
        messages=messages,
    )
    return _extract_text_from_message(response)


async def parse_pdf(file_bytes: bytes) -> ParseResponse:
    """Parse a PDF order receipt via the Anthropic Messages API."""

    text = _extract_pdf_text(file_bytes)

    messages: list[dict[str, Any]] = [
        {"role": "user", "content": _USER_PROMPT.format(text=text)},
    ]
    first_response = await _call_llm(messages)
    try:
        rows, notes = _parse_llm_payload(first_response)
        return ParseResponse(rows=rows, notes=notes)
    except ValueError as initial_error:
        # Retry once with a corrective prompt that quotes the validation
        # error back. If THAT also fails, surface the original error.
        retry_messages = [
            *messages,
            {"role": "assistant", "content": first_response or "(empty)"},
            {
                "role": "user",
                "content": _CORRECTIVE_PROMPT.format(error=str(initial_error)),
            },
        ]
        second_response = await _call_llm(retry_messages)
        try:
            rows, notes = _parse_llm_payload(second_response)
            return ParseResponse(rows=rows, notes=notes)
        except ValueError as retry_error:
            raise ValidationError(detail=f"LLM did not return valid JSON after retry: {retry_error}") from retry_error


# ------------------------------------------------------------- dispatch


def _looks_like_pdf(file_bytes: bytes) -> bool:
    return file_bytes.startswith(b"%PDF")


async def parse_upload(
    *,
    file_bytes: bytes,
    filename: str | None,
    format_hint: ImportFormat = ImportFormat.AUTO,
) -> ParseResponse:
    """Dispatch helper used by the router — sniffs PDF vs CSV when ``auto``."""

    chosen = format_hint
    if chosen is ImportFormat.AUTO:
        if _looks_like_pdf(file_bytes) or (filename and filename.lower().endswith(".pdf")):
            chosen = ImportFormat.PDF
        else:
            chosen = ImportFormat.CSV

    if chosen is ImportFormat.PDF:
        return await parse_pdf(file_bytes)
    return await parse_csv(file_bytes)


# --------------------------------------------------------------- commit


@dataclass(slots=True)
class _ResolveContext:
    """Per-call cache for catalog lookups during ``commit_orders``."""

    company_id: uuid.UUID
    ads_by_external: dict[str, Ad]
    variations: list[ProductVariation]
    products: dict[uuid.UUID, Product]
    clients_by_email: dict[str, Client]
    clients_by_name: dict[str, Client]
    ad_product_ids: dict[uuid.UUID, list[uuid.UUID]]


async def _build_resolve_context(db: AsyncSession, *, company_id: uuid.UUID) -> _ResolveContext:
    ads = list(
        (
            await db.exec(
                scoped(select(Ad), Ad, company_id).where(Ad.external_id.is_not(None))  # type: ignore[union-attr]
            )
        ).all()
    )
    ads_by_external: dict[str, Ad] = {}
    for ad in ads:
        if ad.external_id:
            ads_by_external[ad.external_id.lower()] = ad

    variations = list((await db.exec(scoped(select(ProductVariation), ProductVariation, company_id))).all())

    product_ids = {v.product_id for v in variations}
    if product_ids:
        products_rows = list(
            (
                await db.exec(
                    scoped(select(Product), Product, company_id).where(
                        Product.id.in_(product_ids)  # type: ignore[union-attr]
                    )
                )
            ).all()
        )
    else:
        products_rows = []
    products = {p.id: p for p in products_rows}

    clients = list((await db.exec(scoped(select(Client), Client, company_id))).all())
    clients_by_email: dict[str, Client] = {}
    clients_by_name: dict[str, Client] = {}
    for client in clients:
        if client.email:
            clients_by_email[client.email.lower()] = client
        clients_by_name.setdefault(client.name.lower(), client)

    ad_product_ids: dict[uuid.UUID, list[uuid.UUID]] = {}
    for ad_id, product_id in (
        await db.exec(select(AdProduct.ad_id, AdProduct.product_id).where(AdProduct.company_id == company_id))
    ).all():
        ad_product_ids.setdefault(ad_id, []).append(product_id)

    return _ResolveContext(
        company_id=company_id,
        ads_by_external=ads_by_external,
        variations=variations,
        products=products,
        clients_by_email=clients_by_email,
        clients_by_name=clients_by_name,
        ad_product_ids=ad_product_ids,
    )


def _tokenize(value: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]+", value.lower())
    return {t for t in tokens if t}


def _score_variation(hint_tokens: set[str], variation: ProductVariation, product: Product) -> int:
    """Crude token-overlap score. Boost size + colour exact matches."""

    score = 0
    extras = {
        variation.color.lower(),
        variation.color_code.lower(),
        variation.size.value,
    }
    name_tokens = _tokenize(product.name) | extras
    score += len(hint_tokens & name_tokens)
    # SKU often appears verbatim in the source row.
    if variation.sku and variation.sku.lower() in hint_tokens:
        score += 5
    # Size hits are high-signal (a "G" in the hint is unambiguous).
    if variation.size.value in hint_tokens:
        score += 2
    if variation.color_code.lower() in hint_tokens:
        score += 2
    if variation.color.lower() in hint_tokens:
        score += 1
    return score


def _resolve_variation(
    ctx: _ResolveContext,
    *,
    product_hint: str,
    ad: Ad,
) -> ProductVariation | None:
    """Resolve a variation for the ad's product matching ``product_hint``."""

    hint_tokens = _tokenize(product_hint)
    if not hint_tokens:
        return None

    ad_pids = set(ctx.ad_product_ids.get(ad.id, []))
    same_product = [v for v in ctx.variations if v.product_id in ad_pids]
    if not same_product:
        return None

    # If there's only one variation and any token overlap, accept it.
    if len(same_product) == 1:
        product = ctx.products.get(same_product[0].product_id)
        if product is None:
            return None
        score = _score_variation(hint_tokens, same_product[0], product)
        return same_product[0] if score > 0 else None

    scored = []
    for variation in same_product:
        product = ctx.products.get(variation.product_id)
        if product is None:
            continue
        score = _score_variation(hint_tokens, variation, product)
        scored.append((score, variation))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    if not scored or scored[0][0] <= 0:
        return None
    # Reject ambiguous ties between two variations.
    if len(scored) > 1 and scored[0][0] == scored[1][0]:
        return None
    return scored[0][1]


async def _resolve_or_create_client(
    db: AsyncSession,
    ctx: _ResolveContext,
    *,
    name: str,
    email: str | None,
    phone: str | None,
) -> Client:
    if email:
        existing = ctx.clients_by_email.get(email.lower())
        if existing is not None:
            return existing
    existing = ctx.clients_by_name.get(name.strip().lower())
    if existing is not None:
        return existing

    client = Client(
        company_id=ctx.company_id,
        name=name.strip(),
        email=email,
        phone=phone,
    )
    db.add(client)
    await db.flush()
    ctx.clients_by_name[client.name.lower()] = client
    if client.email:
        ctx.clients_by_email[client.email.lower()] = client
    return client


def _validate_row(row: ParsedOrderRow) -> Iterable[str]:
    if not row.client_name or not row.client_name.strip():
        yield "Missing client name"
    if not row.ad_external_id or not row.ad_external_id.strip():
        yield "Missing ad external id"
    if not row.product_hint or not row.product_hint.strip():
        yield "Missing product hint"
    if row.quantity is None or row.quantity < 1:
        yield "Missing or invalid quantity"
    if row.sale_price is None:
        yield "Missing sale price"
    if row.ordered_at is None:
        yield "Missing order date"


async def commit_orders(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    payload: CommitOrdersBody,
) -> CommitOrdersResponse:
    ctx = await _build_resolve_context(db, company_id=company_id)

    created = 0
    errors: list[CommitOrderError] = []

    for row in payload.rows:
        problems = list(_validate_row(row))
        if problems:
            errors.append(CommitOrderError(row_index=row.row_index, message="; ".join(problems)))
            continue

        # mypy/ty narrowing: validated above.
        assert row.client_name is not None
        assert row.ad_external_id is not None
        assert row.product_hint is not None
        assert row.quantity is not None
        assert row.sale_price is not None
        assert row.ordered_at is not None

        ad = ctx.ads_by_external.get(row.ad_external_id.strip().lower())
        if ad is None:
            errors.append(
                CommitOrderError(
                    row_index=row.row_index,
                    message=f"Ad with external id '{row.ad_external_id}' not found",
                )
            )
            continue

        variation = _resolve_variation(ctx, product_hint=row.product_hint, ad=ad)
        if variation is None:
            errors.append(
                CommitOrderError(
                    row_index=row.row_index,
                    message=f"Could not match product hint '{row.product_hint}' to a variation",
                )
            )
            continue

        client = await _resolve_or_create_client(
            db,
            ctx,
            name=row.client_name,
            email=row.client_email,
            phone=row.client_phone,
        )

        order = Order(
            company_id=company_id,
            ad_id=ad.id,
            variation_id=variation.id,
            client_id=client.id,
            quantity=row.quantity,
            sale_price=row.sale_price,
            ordered_at=row.ordered_at,
            status=OrderStatus.PENDING,
        )
        db.add(order)
        try:
            await db.flush()
        except Exception as exc:
            await db.rollback()
            errors.append(CommitOrderError(row_index=row.row_index, message=str(exc)))
            # The rollback wiped earlier flushes — rebuild ctx so the next
            # iteration sees the actual current state. We rebuild after a
            # rollback rather than on every iteration so the happy path
            # stays fast.
            ctx = await _build_resolve_context(db, company_id=company_id)
            continue

        await write_audit(
            db,
            company_id=company_id,
            user_id=user_id,
            resource_type=_RESOURCE,
            resource_id=order.id,
            message=f"Imported order ORD-{order.id.hex[:8].upper()}",
        )
        created += 1

    if created:
        await db.commit()
    else:
        await db.rollback()

    return CommitOrdersResponse(created=created, errors=errors)


# ------------------------------------------------------------- introspection


# Re-export helpers so tests can exercise them in isolation. They are not
# part of the public router contract but knowing their behaviour matters.
__all__ = [
    "commit_orders",
    "parse_csv",
    "parse_pdf",
    "parse_upload",
]


# Keep ``Size`` imported for the type checker — ``_score_variation`` uses
# the enum value indirectly through ``variation.size.value``.
_ = Size
_ = func  # silence unused-import linter — kept for future SQL helpers
