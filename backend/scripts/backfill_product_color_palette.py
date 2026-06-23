"""Backfill the per-company fabric palette (``company_settings.productColors``).

The product service now treats ``config.productColors`` as the source of truth:
a variation's ``color_code`` must reference a palette entry. Products imported or
created before that change carry colors that were never registered, so this
one-time, idempotent script reconciles every company:

* ensure each existing ``productColors`` entry has a 3-letter ``code`` (derive
  one when missing), and
* fold in every distinct ``(color_code, color)`` actually used by the company's
  ``product_variations`` that isn't in the palette yet.

After this runs, existing products re-save cleanly. Re-running is a no-op.

Usage:  uv run python scripts/backfill_product_color_palette.py [--dry-run]
"""

from __future__ import annotations

import asyncio
import sys
import unicodedata
from pathlib import Path

# Make `src/` importable when run as `python scripts/...`.
_BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_BACKEND_DIR / "src"))
sys.path.insert(0, str(_BACKEND_DIR))

from sqlmodel import select  # noqa: E402

from database import get_session_factory  # noqa: E402
from models import Company, ProductVariation  # noqa: E402
from services import company_settings as settings_service  # noqa: E402

# Portuguese color name → hex, mirroring the importer's ink palette so backfilled
# swatches are sensible; anything unknown falls back to a neutral grey.
_NAME_HEX: list[tuple[str, str]] = [
    ("off white", "#efe6d3"),
    ("offwhite", "#efe6d3"),
    ("branco", "#f4f1ea"),
    ("preto", "#1f1f1f"),
    ("bege", "#cfb98e"),
    ("areia", "#c9b9a3"),
    ("vermelho", "#b03a2e"),
    ("verde", "#3a4a3d"),
    ("marrom", "#7a4b2a"),
    ("azul", "#2a3b5a"),
    ("amarelo", "#e0c040"),
    ("cinza", "#8a8a8a"),
    ("rosa", "#d98aa8"),
    ("laranja", "#d97a2e"),
    ("roxo", "#6a4a8a"),
]
_NEUTRAL_HEX = "#cccccc"


def _norm(text: str) -> str:
    stripped = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    return stripped.strip().lower()


def _hex_for(name: str) -> str:
    n = _norm(name)
    for keyword, value in _NAME_HEX:
        if keyword in n:
            return value
    return _NEUTRAL_HEX


def _candidate_code(name: str) -> str:
    letters = "".join(
        c for c in unicodedata.normalize("NFKD", name) if not unicodedata.combining(c)
    ).upper()
    letters = "".join(c for c in letters if "A" <= c <= "Z")
    return (letters + "XXX")[:3]


def _increment(code: str) -> str:
    n = ((ord(code[0]) - 65) * 676 + (ord(code[1]) - 65) * 26 + (ord(code[2]) - 65) + 1) % 17576
    return chr(65 + n // 676) + chr(65 + (n // 26) % 26) + chr(65 + n % 26)


def _unique_code(name: str, taken: set[str]) -> str:
    code = _candidate_code(name)
    while code in taken:
        code = _increment(code)
    return code


def _reconcile_palette(palette: list[dict], variations: list[tuple[str, str]]) -> list[dict]:
    """Return a palette where every entry has a unique code and every variation
    color is represented. ``variations`` is a list of ``(color_code, color)``."""

    result: list[dict] = []
    taken: set[str] = set()
    by_code: dict[str, dict] = {}

    # 1) Keep existing entries; mint a code for any that lack one.
    for entry in palette:
        name = str(entry.get("name") or "").strip() or "Cor"
        hex_value = str(entry.get("hex") or _hex_for(name))
        code = str(entry.get("code") or "").strip().upper()
        if not code or code in taken:
            code = _unique_code(name, taken)
        taken.add(code)
        item = {"hex": hex_value, "name": name, "code": code}
        result.append(item)
        by_code[code] = item

    # 2) Fold in colors used by variations that aren't registered yet.
    for color_code, color in variations:
        code = (color_code or "").strip().upper()
        name = (color or "").strip() or "Cor"
        if code and code in by_code:
            continue
        if not code or code in taken:
            code = _unique_code(name, taken)
        taken.add(code)
        item = {"hex": _hex_for(name), "name": name, "code": code}
        result.append(item)
        by_code[code] = item

    return result


async def _backfill(dry_run: bool) -> None:
    factory = get_session_factory()
    async with factory() as db:
        companies = list((await db.exec(select(Company))).all())
        print(f"Reconciling fabric palette for {len(companies)} companies (dry_run={dry_run})")

        for company in companies:
            settings = await settings_service.get_settings(db, company_id=company.id)
            palette = list(settings.config.get("productColors") or [])

            variation_rows = (
                await db.exec(
                    select(ProductVariation.color_code, ProductVariation.color)
                    .where(ProductVariation.company_id == company.id)
                    .distinct()
                )
            ).all()
            variations = [(str(c or ""), str(n or "")) for c, n in variation_rows]

            new_palette = _reconcile_palette(palette, variations)
            added = len(new_palette) - len(palette)
            if added <= 0 and all(p.get("code") for p in palette):
                print(f"  {company.subdomain}: up to date ({len(palette)} colors)")
                continue

            print(f"  {company.subdomain}: {len(palette)} → {len(new_palette)} colors (+{max(added, 0)})")
            if not dry_run:
                new_config = {**settings.config, "productColors": new_palette}
                await settings_service.update_settings(
                    db, company_id=company.id, user_id=None, config=new_config
                )

        print("Done.")


def main() -> None:
    dry_run = "--dry-run" in sys.argv[1:]
    asyncio.run(_backfill(dry_run))


if __name__ == "__main__":
    main()
