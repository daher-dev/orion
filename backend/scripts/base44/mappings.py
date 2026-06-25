"""Convert legacy base44 records into Orion row dicts (pure — no DB).

Multi-tenant ETL: the legacy app holds several companies in one base44 app, so
every record carries a base44 ``company_id`` that we resolve to a deterministic
Orion company uuid. The legacy model is denormalized (a ``Produto`` embeds its
variations and trims) and free-text heavy, so this module:

- fans one ``Produto`` out into product_spec + product + N variations + N trims;
- expands size-keyed arrays (cutting outputs, shipment items, stock entries);
- resolves — or auto-creates — the (product, size, color) variation that stock
  rows point at by product+color+size rather than by id;
- synthesizes Orion-required fields with no source (codes, SKUs, 3-letter color
  codes, placeholder numerics), recording every default in the report.

Output is a :class:`ConvertedData` of plain dicts (model kwargs); ``load.py``
turns them into rows. Anything needing the DB (a user's role_id, dedup) rides
on transient ``_``-prefixed keys.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from config import config
from models import ArtworkStatus, FabricType, PrintTechnique, ProductVariation, SeparationStatus, Size
from scripts.base44 import settings
from services.company_settings import default_config

# Deterministic namespace from the app id, so re-runs are stable and references
# resolve to the same uuid every time (BaseModel.id's server_default is
# overridden when we pass an explicit id).
_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, f"base44:{config.BASE44_APP_ID or 'unset'}")

# Orion business tables, in foreign-key (insert) order. Companies and users are
# handled separately in load.py.
TABLE_ORDER: list[str] = [
    "product_spec",
    "spec_trim",
    "print_design",
    "print_design_variation",
    "product",
    "product_variation",
    "fabric_roll",
    "cutting_order",
    "cutting_order_output",
    "sewing_contractor",
    "sewing_shipment",
    "sewing_shipment_item",
    "client",
    "batch",
    "ad",
    "ad_products",
    "order",
    "order_item",
    "imported_order",
    "stock_entry",
    "stock_exit",
    "company_settings",
]


def derive_id(table_key: str, *parts: Any) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, table_key + ":" + ":".join(str(p) for p in parts))


_PIECE_BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _piece_tracking_code(order_id: uuid.UUID, item_index: int) -> str:
    """Deterministic per-piece separation code.

    Mirrors ``services.order_item._piece_tracking_code`` so that pieces created
    here are indistinguishable from ones the live label flow would mint — a
    later ``generate_labels`` call sees them as existing and re-prints
    idempotently (never resetting an already-``checked`` piece).
    """

    acc = int.from_bytes(hashlib.sha256(f"{order_id.hex}:{item_index}".encode()).digest()[:8], "big")
    suffix = ""
    for _ in range(6):
        acc, rem = divmod(acc, 36)
        suffix += _PIECE_BASE36[rem]
    return f"ORD-{order_id.hex[:8].upper()}-{item_index}-{suffix}"


# ── coercion ────────────────────────────────────────────────────────────────
def to_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation, ValueError:
        return None


def to_int(value: Any) -> int | None:
    d = to_decimal(value)
    return int(d) if d is not None else None


def to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"true", "t", "yes", "y", "1", "sim"}
    return False


def _parse_dt(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        token = value.strip().replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(token)
        except ValueError:
            for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
                try:
                    return datetime.strptime(value.strip()[:10], fmt)
                except ValueError:
                    continue
    return None


def to_datetime(value: Any) -> datetime | None:
    return _parse_dt(value)


def to_date(value: Any) -> date | None:
    dt = _parse_dt(value)
    return dt.date() if dt else None


def to_dmy_datetime(value: Any) -> datetime | None:
    """Parse legacy 'DD/MM/YYYY' (PedidoImportado.data_pedido); ISO falls through."""
    if isinstance(value, str) and "/" in value:
        parts = value.strip().split("/")
        if len(parts) == 3 and all(parts):
            try:
                d, m, y = (int(p) for p in parts)
                return datetime(y, m, d, tzinfo=UTC)
            except ValueError, TypeError:
                return None
    return _parse_dt(value)


# ── text helpers ──────────────────────────────────────────────────────────────
def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


def norm(text: Any) -> str:
    return strip_accents(str(text or "")).strip().lower()


def clean_color(value: Any) -> str:
    """Normalize a messy color label to a stable Title-cased display string."""
    raw = strip_accents(str(value or "")).strip()
    raw = re.sub(r"\s+", " ", raw)
    return raw.title()[:40] if raw else "Desconhecida"


# Portuguese ink-color name → hex, ported from the frontend variant-color.ts
# PALETTE. Keys are accent-stripped, lowercased; first key found inside the
# (normalized) name wins, so multi-word labels like "Off White" still resolve.
_INK_HEX_MAP: list[tuple[str, str]] = [
    ("off white", "#efe6d3"),
    ("offwhite", "#efe6d3"),
    ("branco", "#f4f1ea"),
    ("preto", "#1f1f1f"),
    ("bege", "#c9b9a3"),
    ("areia", "#cfb98e"),
    ("vermelho", "#b03a2e"),
    ("verde", "#3a4a3d"),
    ("marrom", "#7a4b2a"),
    ("azul", "#2e4a78"),
    ("amarelo", "#e0c040"),
    ("cinza", "#8a8a8a"),
    ("rosa", "#d98aa8"),
    ("laranja", "#d97a2e"),
    ("roxo", "#6a4a8a"),
]


def ink_hex_for(name: str) -> str:
    """Map an ink-color label to a ``#rrggbb`` hex (satisfies ink_hex_format).

    Known Portuguese color names resolve to the shared palette; anything
    unknown falls back to a deterministic hash of the name so the value is
    stable across re-runs and always a valid 6-hex-digit color.
    """
    n = norm(name)
    for keyword, hex_value in _INK_HEX_MAP:
        if keyword in n:
            return hex_value
    digest = hashlib.md5(n.encode("utf-8")).hexdigest()  # non-crypto, deterministic color
    return "#" + digest[:6]


def keyword_match(text: Any, table: list[tuple[str, Any]], default: Any) -> tuple[Any, bool]:
    """Return (mapped, used_default). First keyword whose accent-stripped form
    appears in the text wins."""
    n = norm(text)
    for keyword, value in table:
        if strip_accents(keyword) in n:
            return value, False
    return default, True


# ── code / color registries (deterministic, per company) ──────────────────────
class CodeRegistry:
    """Generates unique, stable <=20-char codes per company from a name/sku."""

    def __init__(self) -> None:
        self._used: dict[uuid.UUID, set[str]] = {}

    def make(self, company_id: uuid.UUID, *candidates: Any) -> str:
        used = self._used.setdefault(company_id, set())
        source = next((c for c in candidates if c and str(c).strip()), "PROD")
        base = re.sub(r"[^A-Z0-9]", "", strip_accents(str(source)).upper())[:16] or "PROD"
        code, i = base, 1
        while code in used:
            i += 1
            suffix = f"-{i}"
            code = base[: 20 - len(suffix)] + suffix
        used.add(code)
        return code


class ColorCoder:
    """Maps a color to a unique 3-uppercase-letter code per company (^[A-Z]{3}$).

    Also records the canonical display name per code so the importer can emit the
    company's fabric palette (``company_settings.config.productColors``) — the
    source of truth product variations are validated against.
    """

    def __init__(self) -> None:
        self._by_company: dict[uuid.UUID, dict[str, str]] = {}
        self._used: dict[uuid.UUID, set[str]] = {}
        # company → {code: display name} (first name seen for a code wins).
        self._entries: dict[uuid.UUID, dict[str, str]] = {}

    @staticmethod
    def _candidate(color: str) -> str:
        letters = re.sub(r"[^A-Z]", "", strip_accents(color).upper())
        return (letters + "XXX")[:3]

    @staticmethod
    def _increment(code: str) -> str:
        n = (ord(code[0]) - 65) * 676 + (ord(code[1]) - 65) * 26 + (ord(code[2]) - 65)
        n = (n + 1) % 17576
        return chr(65 + n // 676) + chr(65 + (n // 26) % 26) + chr(65 + n % 26)

    def code(self, company_id: uuid.UUID, color: str) -> str:
        table = self._by_company.setdefault(company_id, {})
        key = norm(color)
        if key in table:
            return table[key]
        used = self._used.setdefault(company_id, set())
        code = self._candidate(color)
        while code in used:
            code = self._increment(code)
        used.add(code)
        table[key] = code
        self._entries.setdefault(company_id, {}).setdefault(code, color)
        return code

    def palette(self, company_id: uuid.UUID) -> list[dict[str, str]]:
        """The company's fabric palette as ``[{hex, name, code}]`` (code-sorted)."""

        entries = self._entries.get(company_id, {})
        return [{"hex": ink_hex_for(name), "name": name, "code": code} for code, name in sorted(entries.items())]


# ── reporting ─────────────────────────────────────────────────────────────────
@dataclass
class ConversionReport:
    fetched: dict[str, int] = field(default_factory=dict)
    created: dict[str, int] = field(default_factory=dict)
    inserted: dict[str, int] = field(default_factory=dict)
    skipped: dict[str, int] = field(default_factory=dict)
    skip_samples: dict[str, list[str]] = field(default_factory=dict)
    defaulted: dict[str, int] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    def add(self, table: str, n: int = 1) -> None:
        self.created[table] = self.created.get(table, 0) + n

    def skip(self, reason_key: str, detail: str = "") -> None:
        self.skipped[reason_key] = self.skipped.get(reason_key, 0) + 1
        if detail and len(self.skip_samples.setdefault(reason_key, [])) < 5:
            self.skip_samples[reason_key].append(detail)

    def default(self, field_key: str) -> None:
        self.defaulted[field_key] = self.defaulted.get(field_key, 0) + 1

    def render_markdown(self) -> str:
        lines = ["# base44 import — last run", ""]
        lines += ["| table | created | inserted |", "| --- | --: | --: |"]
        for key in ["company", "user", *TABLE_ORDER]:
            lines.append(f"| {key} | {self.created.get(key, 0)} | {self.inserted.get(key, 0)} |")
        if self.defaulted:
            lines += ["", "## Synthesized / defaulted fields (no source value)"]
            for k, n in sorted(self.defaulted.items(), key=lambda x: -x[1]):
                lines.append(f"- `{k}`: {n}")
        if self.skipped:
            lines += ["", "## Skipped (expected for un-mappable data)"]
            for k, n in sorted(self.skipped.items(), key=lambda x: -x[1]):
                sample = "; ".join(self.skip_samples.get(k, []))
                lines.append(f"- `{k}`: {n}" + (f" — e.g. {sample}" if sample else ""))
        if self.notes:
            lines += ["", "## Notes", *[f"- {n}" for n in self.notes]]
        return "\n".join(lines) + "\n"


@dataclass
class ConvertedData:
    companies: list[dict] = field(default_factory=list)
    users: list[dict] = field(default_factory=list)
    rows: dict[str, list[dict]] = field(default_factory=lambda: {k: [] for k in TABLE_ORDER})
    company_ids: list[uuid.UUID] = field(default_factory=list)


# ── the converter ─────────────────────────────────────────────────────────────
def _records(raw: dict[str, list[dict]], entity: str) -> list[dict]:
    return [r for r in raw.get(entity, []) if isinstance(r, dict)]


def convert(
    raw: dict[str, list[dict]],
    *,
    report: ConversionReport,
    exclude_company_names: set[str] | None = None,
) -> ConvertedData:
    data = ConvertedData()
    codes = CodeRegistry()
    colors = ColorCoder()
    exclude = {norm(n) for n in (exclude_company_names or set())}

    # 1) Companies → deterministic Orion company uuids + unique subdomain slugs.
    # Excluded companies are dropped here; their records then fail company_of()
    # and are skipped (reported), so none of their data leaks in.
    company_map: dict[str, uuid.UUID] = {}
    subdomains: set[str] = set()
    for c in _records(raw, "Company"):
        b44 = str(c.get("id"))
        if norm(c.get("name")) in exclude:
            report.skip("company:excluded", str(c.get("name")))
            continue
        oid = derive_id("company", b44)
        company_map[b44] = oid
        slug = re.sub(r"[^a-z0-9]+", "-", strip_accents(str(c.get("name") or "")).lower()).strip("-")[:50] or "empresa"
        base_slug, i = slug, 1
        while slug in subdomains:
            i += 1
            slug = f"{base_slug[:48]}-{i}"
        subdomains.add(slug)
        data.companies.append(
            {
                "id": oid,
                "name": (c.get("name") or "Empresa")[:120],
                "subdomain": slug,
                "main_color": settings.DEFAULT_MAIN_COLOR,
                "_b44_id": b44,
            }
        )
    for alias, target in settings.COMPANY_ID_ALIASES.items():
        if target in company_map:
            company_map[alias] = company_map[target]
    data.company_ids = list(dict.fromkeys(company_map.values()))
    report.fetched["company"] = len(data.companies)
    report.add("company", len(data.companies))

    def company_of(rec: dict) -> uuid.UUID | None:
        return company_map.get(str(rec.get("company_id")))

    # 2) Users — union of User + UsuarioEmpresa, deduped per (company, email).
    names_by_email: dict[str, str] = {}
    for u in _records(raw, "User"):
        email = norm(u.get("email"))
        if email:
            names_by_email[email] = u.get("full_name") or u.get("nome_display") or u.get("email")
    users: dict[tuple[uuid.UUID, str], dict] = {}
    role_rank = {"admin": 3, "manager": 2, "operator": 1}

    def add_user(company_id, email_raw, role_src, level, name):
        email = (email_raw or "").strip()
        if not email or "@" not in email:
            return
        key = (company_id, email.lower())
        role_code = (
            settings.ROLE_MAP.get(norm(role_src)) or settings.ROLE_MAP.get(norm(level)) or settings.DEFAULT_ROLE_CODE
        )
        existing = users.get(key)
        chosen_name = name or names_by_email.get(email.lower()) or email
        if existing is None:
            users[key] = {
                "id": derive_id("user", company_id, email.lower()),
                "company_id": company_id,
                "firebase_uid": f"{settings.IMPORTED_UID_PREFIX}{company_id}:{email.lower()}",
                "name": str(chosen_name)[:120],
                "email": email[:255],
                "_role_code": role_code,
            }
        elif role_rank.get(role_code, 0) > role_rank.get(existing["_role_code"], 0):
            existing["_role_code"] = role_code

    for ue in _records(raw, "UsuarioEmpresa"):
        cid = company_of(ue)
        if cid:
            add_user(cid, ue.get("email"), ue.get("funcao"), ue.get("role_level"), None)
    for u in _records(raw, "User"):
        cid = company_of(u)
        if cid:
            add_user(
                cid, u.get("email"), u.get("role"), u.get("role_level"), u.get("full_name") or u.get("nome_display")
            )
    data.users = list(users.values())
    report.fetched["user"] = len(_records(raw, "User")) + len(_records(raw, "UsuarioEmpresa"))
    report.add("user", len(data.users))

    # 3) Produto → spec + product + variations + trims.
    product_by_b44: dict[str, dict] = {}
    variation_index: dict[tuple[uuid.UUID, uuid.UUID, str, str], uuid.UUID] = {}

    def register_variation(company_id, product_id, spec_code, size: Size, color_raw, print_code=None) -> uuid.UUID:
        color = clean_color(color_raw)
        ckey = (company_id, product_id, size.value, norm(color))
        if ckey in variation_index:
            return variation_index[ckey]
        color_code = colors.code(company_id, color)
        vid = derive_id("product_variation", product_id, size.value, color_code)
        # ``print_code`` keeps SKUs unique across the (spec x design) products that
        # share a spec — the variation id is already disambiguated by product_id.
        sku = ProductVariation.make_sku(spec_code=spec_code, size=size, color_code=color_code, print_code=print_code)
        data.rows["product_variation"].append(
            {
                "id": vid,
                "company_id": company_id,
                "product_id": product_id,
                "size": size,
                "color": color,
                "color_code": color_code,
                "sku": sku,
            }
        )
        variation_index[ckey] = vid
        report.add("product_variation")
        return vid

    for p in _records(raw, "Produto"):
        cid = company_of(p)
        if cid is None:
            report.skip("produto:unknown_company")
            continue
        b44 = str(p.get("id"))
        spec_id = derive_id("product_spec", b44)
        product_id = derive_id("product", b44)
        spec_code = codes.make(cid, p.get("sku"), p.get("nome"))

        grammage = to_int(p.get("gramatura"))
        if grammage is None or grammage <= 0:
            grammage = settings.DEFAULTS["fabric_grammage_gsm"]
            report.default("product_spec.fabric_grammage_gsm")
        has_ribana = to_bool(p.get("usa_ribana"))
        ribana_pct = to_decimal(p.get("porcentagem_ribana"))
        if has_ribana and (ribana_pct is None or ribana_pct <= 0):
            ribana_pct = Decimal(settings.DEFAULTS["ribana_weight_pct"])
            report.default("product_spec.ribana_weight_pct")
        if ribana_pct is not None and ribana_pct > 100:
            ribana_pct = Decimal("100")
        fabric_type, used_default = keyword_match(
            f"{p.get('tipo_tecido') or ''} {p.get('nome') or ''}",
            settings.FABRIC_TYPE_KEYWORDS,
            settings.DEFAULT_FABRIC_TYPE,
        )
        if used_default:
            report.default("product_spec.fabric_type")
        report.default("product_spec.fabric_weight_per_piece_g")
        report.default("product_spec.sale_price")
        notes_bits = [p.get("observacoes") or ""]
        if p.get("custo") is not None:
            notes_bits.append(f"custo legado: {p.get('custo')}")
        data.rows["product_spec"].append(
            {
                "id": spec_id,
                "company_id": cid,
                "code": spec_code,
                "name": (p.get("nome") or spec_code)[:120],
                "fabric_type": fabric_type,
                "fabric_grammage_gsm": grammage,
                "fabric_weight_per_piece_g": Decimal(settings.DEFAULTS["fabric_weight_per_piece_g"]),
                "has_ribana": has_ribana,
                "ribana_weight_pct": ribana_pct if has_ribana else None,
                "labor_cost": to_decimal(p.get("custo_costura_por_peca")) or Decimal("0"),
                "sale_price": Decimal(settings.DEFAULTS["sale_price"]),
                "notes": " | ".join(b for b in notes_bits if b) or None,
            }
        )
        report.add("product_spec")

        for idx, a in enumerate(p.get("aviamentos") or []):
            if not isinstance(a, dict):
                continue
            trim_type, _ = keyword_match(a.get("nome"), settings.TRIM_TYPE_KEYWORDS, settings.DEFAULT_TRIM_TYPE)
            data.rows["spec_trim"].append(
                {
                    "id": derive_id("spec_trim", b44, idx),
                    "spec_id": spec_id,
                    "trim_type": trim_type,
                    "unit_price": to_decimal(a.get("custo_unitario")) or Decimal("0"),
                    "quantity": settings.DEFAULTS["trim_quantity"],
                }
            )
            report.add("spec_trim")

        product_type, _ = keyword_match(
            f"{p.get('tipo') or ''} {p.get('nome') or ''}",
            settings.PRODUCT_TYPE_KEYWORDS,
            settings.DEFAULT_PRODUCT_TYPE,
        )
        data.rows["product"].append(
            {
                "id": product_id,
                "company_id": cid,
                "name": (p.get("nome") or spec_code)[:120],
                "product_type": product_type,
                "spec_id": spec_id,
                "print_id": None,
            }
        )
        report.add("product")
        product_by_b44[b44] = {
            "company_id": cid,
            "product_id": product_id,
            "spec_id": spec_id,
            "spec_code": spec_code,
            "product_type": product_type,
            "name": (p.get("nome") or spec_code),
        }

        for v in p.get("variacoes") or []:
            if not isinstance(v, dict):
                continue
            for sz in v.get("tamanhos") or []:
                size = settings.SIZE_MAP.get(norm(sz))
                if size is None:
                    report.skip("variation:size", f"{p.get('nome')}:{sz}")
                    continue
                register_variation(cid, product_id, spec_code, size, v.get("cor"))

    report.fetched["product_spec"] = len(_records(raw, "Produto"))

    def resolve_variation(produto_id, color_raw, size: Size) -> uuid.UUID | None:
        info = product_by_b44.get(str(produto_id))
        if info is None:
            return None
        return register_variation(info["company_id"], info["product_id"], info["spec_code"], size, color_raw)

    # 4) BobinaTecido → fabric_roll
    fabric_by_b44: dict[str, uuid.UUID] = {}
    fabric_color_by_b44: dict[str, str] = {}
    for b in _records(raw, "BobinaTecido"):
        cid = company_of(b)
        if cid is None:
            report.skip("fabric:unknown_company")
            continue
        b44 = str(b.get("id"))
        kind = settings.FABRIC_ROLL_KIND_MAP.get(norm(b.get("tipo"))) or settings.FABRIC_ROLL_KIND_MAP["tecido"]
        if norm(b.get("tipo")) == "ribana":
            fabric_type = FabricType.RIB
        else:
            fabric_type, _ = keyword_match(
                b.get("nome_tecido"), settings.FABRIC_TYPE_KEYWORDS, settings.DEFAULT_FABRIC_TYPE
            )
        # peso_inicial is per-roll; quantidade_bobinas is the count in this receipt.
        per_roll = to_decimal(b.get("peso_inicial"))
        qty_rolls = to_int(b.get("quantidade_bobinas")) or 1
        initial = per_roll * qty_rolls if per_roll and per_roll > 0 else None
        if initial is None or initial <= 0:
            initial = Decimal(settings.DEFAULTS["fabric_initial_weight_kg"])
            report.default("fabric_roll.initial_weight_kg")
        current = Decimal("0") if norm(b.get("status")) == "consumida" else initial
        received = to_date(b.get("data_recebimento")) or to_date(b.get("created_date"))
        if received is None:
            report.skip("fabric:no_received_date", b44)
            continue
        fid = derive_id("fabric_roll", b44)
        data.rows["fabric_roll"].append(
            {
                "id": fid,
                "company_id": cid,
                "received_at": received,
                "supplier_name": (b.get("fornecedor") or "—")[:120],
                "kind": kind,
                "fabric_type": fabric_type,
                "initial_weight_kg": initial,
                "current_weight_kg": current,
                "color": clean_color(b.get("cor_tecido")),
                "price_per_kg": to_decimal(b.get("preco_kg")) or Decimal("0"),
            }
        )
        fabric_by_b44[b44] = fid
        fabric_color_by_b44[b44] = clean_color(b.get("cor_tecido"))
        report.add("fabric_roll")
    report.fetched["fabric_roll"] = len(_records(raw, "BobinaTecido"))

    # 5) OrdemCorte → cutting_order + outputs
    # base44 frequently references a deleted/un-exported body roll, and sometimes
    # only a product *name* (no produto_id). The Orion model already allows a
    # roll-less cutting order (planning creates them before a roll is assigned),
    # so we require only a resolvable spec — recovered by produto_id, else by
    # matching nome_produto to a spec already built for the company — and import
    # the order without a body roll when base44's roll is missing.
    spec_id_by_name: dict[tuple[uuid.UUID, str], uuid.UUID] = {}
    for s in data.rows["product_spec"]:
        spec_id_by_name.setdefault((s["company_id"], norm(s["name"])), s["id"])
    cutting_by_b44: dict[str, uuid.UUID] = {}
    for o in _records(raw, "OrdemCorte"):
        cid = company_of(o)
        if cid is None:
            report.skip("cutting:unknown_company")
            continue
        info = product_by_b44.get(str(o.get("produto_id")))
        spec_id = info["spec_id"] if info else spec_id_by_name.get((cid, norm(o.get("nome_produto"))))
        if spec_id is None:
            report.skip("cutting:missing_product", str(o.get("id")))
            continue
        body = fabric_by_b44.get(str(o.get("bobina_id")))  # may be None: base44 roll deleted/un-exported
        if body is None:
            report.default("cutting_order.no_body_roll")
        b44 = str(o.get("id"))
        oid = derive_id("cutting_order", b44)
        rib = fabric_by_b44.get(str(o.get("bobina_ribana_id"))) if o.get("bobina_ribana_id") else None
        # rib_requires_body CHECK: a rib roll can't be kept without a body roll.
        if body is None or rib == body:
            rib = None
        # Cutting is print-agnostic: keyed by spec + colorway. Prefer the order's
        # own color, falling back to the body roll's color when absent.
        body_color = fabric_color_by_b44.get(str(o.get("bobina_id")))
        color = clean_color(o.get("cor") or body_color or "Único")
        color_code = colors.code(cid, color)
        data.rows["cutting_order"].append(
            {
                "id": oid,
                "company_id": cid,
                "spec_id": spec_id,
                "color": color[:40],
                "color_code": color_code,
                "body_roll_id": body,
                "rib_roll_id": rib,
                "status": settings.CUTTING_STATUS_MAP.get(norm(o.get("status")), settings.DEFAULT_CUTTING_STATUS),
                "cut_at": to_datetime(o.get("data_corte")),
            }
        )
        cutting_by_b44[b44] = oid
        report.add("cutting_order")
        by_size: dict[str, int] = {}
        for t in o.get("tamanhos") or []:
            if not isinstance(t, dict):
                continue
            size = settings.SIZE_MAP.get(norm(t.get("tamanho")))
            qty = to_int(t.get("quantidade")) or 0
            if size is None or qty < 0:
                report.skip("cutting_output:size", str(t.get("tamanho")))
                continue
            by_size[size.value] = by_size.get(size.value, 0) + qty
        for size_val, qty in by_size.items():
            data.rows["cutting_order_output"].append(
                {
                    "id": derive_id("cutting_order_output", b44, size_val),
                    "cutting_order_id": oid,
                    "size": Size(size_val),
                    "quantity": qty,
                }
            )
            report.add("cutting_order_output")
    report.fetched["cutting_order"] = len(_records(raw, "OrdemCorte"))

    # 6) BancaCostura → sewing_contractor (dedupe names within a company)
    contractor_by_b44: dict[str, uuid.UUID] = {}
    contractor_names: dict[uuid.UUID, set[str]] = {}
    for b in _records(raw, "BancaCostura"):
        cid = company_of(b)
        if cid is None:
            report.skip("contractor:unknown_company")
            continue
        b44 = str(b.get("id"))
        name = (b.get("nome_banca") or "Banca")[:120]
        seen = contractor_names.setdefault(cid, set())
        base, n = name, 1
        while name.lower() in seen:
            n += 1
            name = f"{base[:115]} ({n})"
        seen.add(name.lower())
        scid = derive_id("sewing_contractor", b44)
        phone = str(b.get("contato"))[:40] if b.get("contato") else None
        data.rows["sewing_contractor"].append(
            {"id": scid, "company_id": cid, "name": name, "address": None, "phone": phone}
        )
        contractor_by_b44[b44] = scid
        report.add("sewing_contractor")
    report.fetched["sewing_contractor"] = len(_records(raw, "BancaCostura"))

    # 7) RemessaCostura → sewing_shipment + items
    for r in _records(raw, "RemessaCostura"):
        cid = company_of(r)
        if cid is None:
            report.skip("shipment:unknown_company")
            continue
        # base44 shipments often reference a cutting order that was deleted or
        # never exported; the cutting link is an optional upstream pointer, not
        # the substance of the remessa (which is contractor + product + sizes).
        # Import the shipment standalone when the cutting order can't be resolved.
        cutting = cutting_by_b44.get(str(r.get("ordem_corte_id")))
        contractor = contractor_by_b44.get(str(r.get("banca_id")))
        if contractor is None:
            report.skip("shipment:missing_contractor", str(r.get("id")))
            continue
        if cutting is None:
            report.default("sewing_shipment.no_cutting_link")
        sent = to_date(r.get("data_envio")) or to_date(r.get("created_date"))
        if sent is None:
            report.skip("shipment:no_sent_date", str(r.get("id")))
            continue
        b44 = str(r.get("id"))
        sid = derive_id("sewing_shipment", b44)
        data.rows["sewing_shipment"].append(
            {
                "id": sid,
                "company_id": cid,
                "cutting_order_id": cutting,
                "contractor_id": contractor,
                "sent_at": sent,
                "received_at": None,
                "status": settings.SHIPMENT_STATUS_MAP.get(norm(r.get("status")), settings.DEFAULT_SHIPMENT_STATUS),
            }
        )
        report.add("sewing_shipment")
        req: dict[str, int] = {}
        rec: dict[str, int] = {}
        for t in r.get("tamanhos_enviados") or []:
            if isinstance(t, dict) and (s := settings.SIZE_MAP.get(norm(t.get("tamanho")))):
                req[s.value] = req.get(s.value, 0) + (to_int(t.get("quantidade")) or 0)
        for t in r.get("tamanhos_entregues") or []:
            if isinstance(t, dict) and (s := settings.SIZE_MAP.get(norm(t.get("tamanho")))):
                rec[s.value] = rec.get(s.value, 0) + (to_int(t.get("quantidade")) or 0)
        for size_val in set(req) | set(rec):
            requested = req.get(size_val, 0)
            received = rec.get(size_val, 0)
            if requested == 0:
                requested = received  # received-without-requested → treat as both
            received = min(received, requested)
            data.rows["sewing_shipment_item"].append(
                {
                    "id": derive_id("sewing_shipment_item", b44, size_val),
                    "shipment_id": sid,
                    "size": Size(size_val),
                    "requested_quantity": requested,
                    "received_quantity": received,
                }
            )
            report.add("sewing_shipment_item")
    report.fetched["sewing_shipment"] = len(_records(raw, "RemessaCostura"))

    # 8) EntradaEstoque → stock_entry (one per size in itens_tamanho)
    for e in _records(raw, "EntradaEstoque"):
        cid = company_of(e)
        if cid is None:
            report.skip("stock_entry:unknown_company")
            continue
        for t in e.get("itens_tamanho") or []:
            if not isinstance(t, dict):
                continue
            size = settings.SIZE_MAP.get(norm(t.get("tamanho")))
            qty = to_int(t.get("quantidade")) or 0
            if size is None or qty <= 0:
                report.skip("stock_entry:size_or_qty", f"{t.get('tamanho')}={t.get('quantidade')}")
                continue
            vid = resolve_variation(e.get("produto_id"), e.get("cor"), size)
            if vid is None:
                report.skip("stock_entry:no_product", str(e.get("produto_id")))
                continue
            data.rows["stock_entry"].append(
                {
                    "id": derive_id("stock_entry", str(e.get("id")), size.value),
                    "company_id": cid,
                    "variation_id": vid,
                    "quantity": qty,
                    "source": settings.DEFAULT_STOCK_SOURCE,
                    "notes": e.get("observacoes") or None,
                }
            )
            report.add("stock_entry")
    report.fetched["stock_entry"] = len(_records(raw, "EntradaEstoque"))

    # 9) SaidaEstoque → stock_exit (flat: one row each)
    for s in _records(raw, "SaidaEstoque"):
        cid = company_of(s)
        if cid is None:
            report.skip("stock_exit:unknown_company")
            continue
        size = settings.SIZE_MAP.get(norm(s.get("tamanho")))
        qty = to_int(s.get("quantidade")) or 0
        if size is None:
            report.skip("stock_exit:size", str(s.get("tamanho")))
            continue
        if qty <= 0:
            report.skip("stock_exit:qty", str(s.get("quantidade")))
            continue
        vid = resolve_variation(s.get("produto_id"), s.get("cor"), size)
        if vid is None:
            report.skip("stock_exit:no_product", str(s.get("produto_id")))
            continue
        data.rows["stock_exit"].append(
            {
                "id": derive_id("stock_exit", str(s.get("id"))),
                "company_id": cid,
                "variation_id": vid,
                "order_id": None,
                "quantity": qty,
                "reason": settings.STOCK_EXIT_REASON_MAP.get(norm(s.get("motivo")), settings.DEFAULT_STOCK_EXIT_REASON),
                "notes": s.get("observacoes") or None,
            }
        )
        report.add("stock_exit")
    report.fetched["stock_exit"] = len(_records(raw, "SaidaEstoque"))

    # ── Mapeamento: print catalog (StampaMemory → PrintDesign) + indexes ──
    products_by_company: dict[uuid.UUID, list[dict]] = {}
    for _info in product_by_b44.values():
        products_by_company.setdefault(_info["company_id"], []).append(_info)

    stampa_title_type: dict[tuple[uuid.UUID, str], str] = {}
    print_design_index: dict[tuple[uuid.UUID, str], uuid.UUID] = {}
    design_code_by_id: dict[uuid.UUID, str] = {}
    # ad title → design: the bridge that lets an order recover its estampa. A
    # legacy ``StampaMemory`` row pairs ``titulo_anuncio`` (the listing an order
    # carries) with ``estampa_nome`` (the design); the order resolver uses it to
    # pick the (spec x design) product. First title→design wins.
    design_by_title: dict[tuple[uuid.UUID, str], uuid.UUID] = {}
    # The real artwork lives in each record's ``combinacoes[]`` (the top-level
    # ``foto_estampa_url`` is empty in practice). A design's combos are spread
    # across every StampaMemory row sharing its name, so we (a) create the bare
    # design row on first sight, (b) accumulate combos by design id, then (c)
    # sweep the aggregates once to fill image fields and emit one variation per
    # distinct ink color.
    design_row_by_id: dict[uuid.UUID, dict] = {}
    design_company_by_id: dict[uuid.UUID, uuid.UUID] = {}
    combos_by_design: dict[uuid.UUID, list[dict]] = {}
    for sm in _records(raw, "StampaMemory"):
        scid = company_of(sm)
        if scid is None:
            continue
        stitle = norm(sm.get("titulo_anuncio"))
        if stitle and sm.get("tipo_produto") and (scid, stitle) not in stampa_title_type:
            stampa_title_type[(scid, stitle)] = str(sm.get("tipo_produto"))
        ename = str(sm.get("estampa_nome") or "").strip()
        if not ename or norm(ename) in {"n/a", "-"}:
            continue
        dkey = (scid, norm(ename))
        did = print_design_index.get(dkey)
        if did is None:
            did = derive_id("print_design", scid, norm(ename))
            design_code = codes.make(scid, ename)
            row = {
                "id": did,
                "company_id": scid,
                "code": design_code,
                "name": ename[:120],
                "image_url": None,
                "cost_per_unit": Decimal("0"),
                "technique": PrintTechnique.DTF,
                "has_front": False,
                "has_back": False,
                "image_url_front": None,
                "image_url_back": None,
            }
            data.rows["print_design"].append(row)
            print_design_index[dkey] = did
            design_code_by_id[did] = design_code
            design_row_by_id[did] = row
            design_company_by_id[did] = scid
            report.add("print_design")
        combos = sm.get("combinacoes")
        if isinstance(combos, list):
            combos_by_design.setdefault(did, []).extend(c for c in combos if isinstance(c, dict))
        if stitle:
            design_by_title.setdefault((scid, stitle), did)
    report.fetched["print_design"] = len(_records(raw, "StampaMemory"))

    # ── Second pass: artwork. Populate each design's image fields from its
    # aggregated combos and emit one print_design_variation per distinct ink
    # color (clean_color(cor_estampa)); the first combo carrying artwork wins.
    def _combo_url(combo: dict, *keys: str) -> str | None:
        for key in keys:
            value = combo.get(key)
            if value and str(value).strip():
                return str(value).strip()
        return None

    for did, combos in combos_by_design.items():
        row = design_row_by_id.get(did)
        if row is None:
            continue
        scid = design_company_by_id[did]
        thumb_front: str | None = None
        thumb_back: str | None = None
        # Per-ink artwork accumulated across ALL combos: the first non-null
        # front/back url for each ink wins, so a later same-ink combo (possibly
        # from another StampaMemory record that aggregated in) can supply artwork
        # an earlier one lacked.
        inks: dict[str, dict] = {}
        for combo in combos:
            front_url = _combo_url(combo, "arquivo_png_url_frente", "arquivo_png_url")
            back_url = _combo_url(combo, "arquivo_png_url_costas")
            if thumb_front is None and front_url:
                thumb_front = front_url
            if thumb_back is None and back_url:
                thumb_back = back_url
            color_raw = combo.get("cor_estampa")
            ink_key = norm(color_raw)
            if not ink_key or ink_key in {"n/a", "-"}:
                continue
            ink = inks.setdefault(ink_key, {"name": clean_color(color_raw), "front": None, "back": None})
            if ink["front"] is None and front_url:
                ink["front"] = front_url
            if ink["back"] is None and back_url:
                ink["back"] = back_url
        for ink_key, ink in inks.items():
            front_url, back_url = ink["front"], ink["back"]
            data.rows["print_design_variation"].append(
                {
                    "id": derive_id("print_design_variation", did, ink_key),
                    "company_id": scid,
                    "print_design_id": did,
                    "name": ink["name"],
                    "ink_hex": ink_hex_for(ink["name"]),
                    "front_file_url": front_url,
                    "front_status": ArtworkStatus.OK if front_url else ArtworkStatus.PENDING,
                    "back_file_url": back_url,
                    "back_status": ArtworkStatus.OK if back_url else ArtworkStatus.PENDING,
                }
            )
            report.add("print_design_variation")
        row["image_url"] = thumb_front or thumb_back or None
        row["image_url_front"] = thumb_front
        row["image_url_back"] = thumb_back
        row["has_front"] = thumb_front is not None
        row["has_back"] = thumb_back is not None

    def _types_in(text) -> set:
        n = norm(text)
        return {pt for kw, pt in settings.PRODUCT_TYPE_KEYWORDS if strip_accents(kw) in n}

    # 10) PedidoImportado → order + imported_order. Each order resolves to ONE
    # (spec x design) product: the garment spec by type keyword, the design via
    # the StampaMemory ad-title bridge — and the Ad is bound to that single
    # product. No design → the spec's base no-print product (cut-only); no garment
    # match → a synthetic "Pedidos importados" product. client_id/sale_price stay NULL.
    synth: dict[uuid.UUID, dict] = {}
    ad_index: dict[tuple, uuid.UUID] = {}
    ad_products_index: dict[uuid.UUID, list[dict]] = {}
    # (company, spec, design) → the resolved (spec x design) product info, created once.
    design_product_index: dict[tuple[uuid.UUID, uuid.UUID, uuid.UUID], dict] = {}
    order_keys: set[tuple] = set()
    import_keys: set[tuple] = set()
    order_row_by_pi: dict[str, dict] = {}
    real_matches = 0
    synth_matches = 0
    design_orders = 0
    nodesign_orders = 0

    def _synth_product(company_id: uuid.UUID) -> dict:
        info = synth.get(company_id)
        if info is not None:
            return info
        spec_code = codes.make(company_id, "IMPORTADOS")
        spec_id = derive_id("product_spec", "marketplace-import", company_id)
        product_id = derive_id("product", "marketplace-import", company_id)
        data.rows["product_spec"].append(
            {
                "id": spec_id,
                "company_id": company_id,
                "code": spec_code,
                "name": "Pedidos importados",
                "fabric_type": settings.DEFAULT_FABRIC_TYPE,
                "fabric_grammage_gsm": settings.DEFAULTS["fabric_grammage_gsm"],
                "fabric_weight_per_piece_g": Decimal(settings.DEFAULTS["fabric_weight_per_piece_g"]),
                "has_ribana": False,
                "ribana_weight_pct": None,
                "labor_cost": Decimal("0"),
                "sale_price": Decimal(settings.DEFAULTS["sale_price"]),
                "notes": "Catálogo sintético para pedidos de marketplace importados.",
            }
        )
        data.rows["product"].append(
            {
                "id": product_id,
                "company_id": company_id,
                "name": "Pedidos importados",
                "product_type": settings.DEFAULT_PRODUCT_TYPE,
                "spec_id": spec_id,
                "print_id": None,
            }
        )
        report.add("product_spec")
        report.add("product")
        info = {
            "company_id": company_id,
            "product_id": product_id,
            "spec_id": spec_id,
            "spec_code": spec_code,
            "product_type": settings.DEFAULT_PRODUCT_TYPE,
            "name": "Pedidos importados",
        }
        synth[company_id] = info
        return info

    def _get_or_make_product(company_id: uuid.UUID, spec_info: dict, design_id: uuid.UUID | None) -> dict:
        """Resolve the (spec x design) product an order/ad maps to.

        ``design_id is None`` → the spec's base (no-print) product, which doubles
        as the blank-garment SKU family + the home for design-agnostic legacy
        stock. Otherwise a product keyed by ``(spec, design)`` is created once (the
        ``uq_products_spec_id_print_id`` constraint allows exactly one) carrying the
        design as ``print_id``, so the whole demand → cut/print engine can resolve
        what to print.
        """

        design_code = design_code_by_id.get(design_id) if design_id is not None else None
        if design_id is None or design_code is None:
            # No design (or a design with no code) → the base no-print product; its
            # SKU has no print segment, so it must never masquerade as a design.
            return spec_info
        pkey = (company_id, spec_info["spec_id"], design_id)
        existing = design_product_index.get(pkey)
        if existing is not None:
            return existing
        product_id = derive_id("product", "design", spec_info["spec_id"], design_id)
        data.rows["product"].append(
            {
                "id": product_id,
                "company_id": company_id,
                "name": (f"{spec_info['name']} · {design_code}"[:120] if design_code else spec_info["name"]),
                "product_type": spec_info["product_type"],
                "spec_id": spec_info["spec_id"],
                "print_id": design_id,
            }
        )
        report.add("product")
        info = {
            "company_id": company_id,
            "product_id": product_id,
            "spec_id": spec_info["spec_id"],
            "spec_code": spec_info["spec_code"],
            "product_type": spec_info["product_type"],
            "name": spec_info["name"],
            "print_code": design_code,
        }
        design_product_index[pkey] = info
        return info

    def _get_or_build_ad(company_id: uuid.UUID, marketplace: str, title_raw) -> uuid.UUID:
        eco, _ = keyword_match(marketplace, settings.ECOMMERCE_KEYWORDS, settings.DEFAULT_ECOMMERCE)
        title = str(title_raw or "").strip()
        tnorm = norm(title)
        key = (company_id, eco.value, tnorm)
        if key in ad_index:
            return ad_index[key]
        ad_id = derive_id("ad", company_id, eco.value, tnorm or "untitled")
        # Resolve the garment spec (by type keyword), then the design (by ad
        # title), and bind the ad to that single (spec x design) product.
        types = _types_in(f"{title} {stampa_title_type.get((company_id, tnorm), '')}")
        candidates = [i for i in products_by_company.get(company_id, []) if i["product_type"] in types] if types else []
        if candidates:
            spec_info = candidates[0]
        else:
            spec_info = _synth_product(company_id)
            report.skip("ad:no_real_product_match", title[:60] or "(untitled)")
        design_id = design_by_title.get((company_id, tnorm))
        if design_id is not None:
            report.default("ad.design_linked")
        else:
            report.skip("ad:no_design_match", title[:60] or "(untitled)")
        product_info = _get_or_make_product(company_id, spec_info, design_id)
        data.rows["ad"].append(
            {
                "id": ad_id,
                "company_id": company_id,
                "title": (title or f"Importados — {eco.value}")[:200],
                "ecommerce": eco,
                "external_id": None,
            }
        )
        report.add("ad")
        data.rows["ad_products"].append(
            {
                "id": derive_id("ad_product", ad_id, product_info["product_id"]),
                "company_id": company_id,
                "ad_id": ad_id,
                "product_id": product_info["product_id"],
            }
        )
        report.add("ad_products")
        ad_index[key] = ad_id
        ad_products_index[ad_id] = [product_info]
        return ad_id

    for po in _records(raw, "PedidoImportado"):
        cid = company_of(po)
        if cid is None:
            report.skip("order:unknown_company")
            continue
        size = settings.SIZE_MAP.get(norm(po.get("tamanho")))
        qty = to_int(po.get("quantidade")) or 0
        if size is None:
            report.skip("order:size", str(po.get("tamanho")))
            continue
        if qty <= 0:
            report.skip("order:qty", str(po.get("quantidade")))
            continue
        marketplace = str(po.get("marketplace") or "Não informado").strip() or "Não informado"
        ad_id = _get_or_build_ad(cid, marketplace, po.get("titulo_anuncio"))
        chosen = (ad_products_index.get(ad_id) or [_synth_product(cid)])[0]
        vid = register_variation(
            cid, chosen["product_id"], chosen["spec_code"], size, po.get("cor"), print_code=chosen.get("print_code")
        )
        if chosen["product_id"] == synth.get(cid, {}).get("product_id"):
            synth_matches += 1
        else:
            real_matches += 1
        if chosen.get("print_code"):
            design_orders += 1
        else:
            nodesign_orders += 1
        external = str(po.get("numero_pedido") or "").strip() or None
        sku = str(po.get("sku") or "").strip()
        platform_order_id = external or str(po.get("id"))
        order_key = (cid, ad_id, vid, external)
        if external is not None and order_key in order_keys:
            report.skip("order:dup_line", f"{external} {size.value}/{po.get('cor')}")
            continue
        import_key = (cid, norm(marketplace), platform_order_id, sku)
        if import_key in import_keys:
            report.skip("order:dup_import", f"{marketplace}/{platform_order_id}/{sku}")
            continue
        ordered_at = to_dmy_datetime(po.get("data_pedido")) or to_datetime(po.get("created_date")) or datetime.now(UTC)
        oid = derive_id("order", str(po.get("id")))
        order_row = {
            "id": oid,
            "company_id": cid,
            "ad_id": ad_id,
            "variation_id": vid,
            "client_id": None,
            "quantity": qty,
            "sale_price": None,
            "ordered_at": ordered_at,
            "status": settings.DEFAULT_ORDER_STATUS,
            "external_order_id": external[:120] if external else None,
            "batch_id": None,
        }
        data.rows["order"].append(order_row)
        report.add("order")
        order_row_by_pi[str(po.get("id"))] = order_row
        data.rows["imported_order"].append(
            {
                "id": derive_id("imported_order", str(po.get("id"))),
                "company_id": cid,
                "order_id": oid,
                "source": "base44",
                "marketplace": marketplace[:60],
                "platform_order_id": platform_order_id[:120],
                "ad_title": (str(po.get("titulo_anuncio") or "").strip() or "—")[:300],
                "sku": sku[:120],
                "variation_text": f"{po.get('cor') or ''} / {po.get('tamanho') or ''}"[:200],
                "color": clean_color(po.get("cor")) or None,
                "size": str(po.get("tamanho") or "").strip() or None,
                "quantity": qty,
                "image_url": (str(po.get("foto_url")).strip() or None) if po.get("foto_url") else None,
            }
        )
        report.add("imported_order")

        # Separation pieces (order_items) — synthesized one-per-unit so the
        # dashboard *conferência* reflects the legacy ORDER-level conference, the
        # exact signal the Base44 homepage reads (``PedidoImportado.status_conferencia``).
        # The per-piece ``ItemPedido`` entity is NOT a faithful source: it carries
        # the picking-scan state (almost all "pendente"), not the order conference.
        # ``item_index`` 1..N + the deterministic tracking code match
        # ``generate_labels`` so a later live re-print stays idempotent.
        conf = norm(po.get("status_conferencia"))
        checked = conf == "conferido"
        checked_at = to_datetime(po.get("conferido_em")) if checked else None
        checked_by = (
            str(po.get("conferido_por")).strip()[:255] if checked and po.get("conferido_por") else None
        )
        piece_status = SeparationStatus.CHECKED if checked else SeparationStatus.PENDING
        estampa_print = str(po.get("estampa_mapeada") or "").strip()
        if norm(estampa_print) in {"n/a", "-"}:
            estampa_print = ""
        for idx in range(1, qty + 1):
            data.rows["order_item"].append(
                {
                    "id": derive_id("order_item", str(po.get("id")), idx),
                    "company_id": cid,
                    "order_id": oid,
                    "variation_id": vid,
                    "tracking_code": _piece_tracking_code(oid, idx),
                    "status": piece_status,
                    "checked_at": checked_at,
                    "checked_by": checked_by,
                    "mapped_print": estampa_print[:120] if estampa_print else None,
                    "item_index": idx,
                    "total_items": qty,
                }
            )
            report.add("order_item")

        order_keys.add(order_key)
        import_keys.add(import_key)
    report.fetched["order"] = len(_records(raw, "PedidoImportado"))
    report.fetched["imported_order"] = len(_records(raw, "PedidoImportado"))
    report.notes.append(f"order→product match: {real_matches} real, {synth_matches} synthetic")
    report.notes.append(f"order→design match: {design_orders} with design, {nodesign_orders} no-design (cut-only)")

    # 11) LoteProducao → batch (+ Order.batch_id backfill + print adjustments)
    for lote in _records(raw, "LoteProducao"):
        cid = company_of(lote)
        if cid is None:
            report.skip("batch:unknown_company")
            continue
        b44 = str(lote.get("id"))
        batch_id = derive_id("batch", b44)
        data.rows["batch"].append(
            {
                "id": batch_id,
                "company_id": cid,
                "code": str(lote.get("codigo") or b44)[:40],
                "name": (str(lote.get("nome")).strip()[:120] if lote.get("nome") else None),
                "status": settings.BATCH_STATUS_MAP.get(norm(lote.get("status")), settings.DEFAULT_BATCH_STATUS),
                "total_orders": to_int(lote.get("total_pedidos")) or 0,
                "total_pieces": to_int(lote.get("total_pecas")) or 0,
                "labels_printed_at": to_datetime(lote.get("etiquetas_impressas_em")),
                "completed_at": to_datetime(lote.get("concluido_em")),
                "notes": (str(lote.get("observacoes")).strip()[:500] if lote.get("observacoes") else None),
            }
        )
        report.add("batch")
        for pi in lote.get("pedido_ids") or []:
            row = order_row_by_pi.get(str(pi))
            if row is not None:
                row["batch_id"] = batch_id
                report.default("batch.order_linked")
            else:
                report.skip("batch:pedido_unresolved", str(pi))
    report.fetched["batch"] = len(_records(raw, "LoteProducao"))

    # 12) Separation pieces (order_items) are synthesized per order in step 10
    # from the legacy ORDER-level conference (PedidoImportado.status_conferencia).
    # The per-piece ItemPedido entity is intentionally NOT imported: its
    # status_separacao is almost entirely "pendente" (the picking scan, not the
    # conference), so importing it would zero out the conferência the Base44
    # homepage actually shows.
    report.fetched["order_item"] = len(data.rows["order_item"])

    # Company settings: seed the catalog config and make the fabric palette the
    # source of truth for the colors the import just coded onto variations. Every
    # variation/cutting color the ColorCoder assigned a code lands in
    # productColors, so the new product-service enforcement accepts them.
    for company_id in data.company_ids:
        cfg = default_config()
        palette = colors.palette(company_id)
        if palette:
            cfg["productColors"] = palette
        data.rows["company_settings"].append(
            {
                "id": derive_id("company_settings", company_id),
                "company_id": company_id,
                "config": cfg,
            }
        )
        report.add("company_settings")

    return data
