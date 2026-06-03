"""PHASE 0 — sample base44 and emit a schema report.

base44 has no "list entities" API, so this probes the candidate names in
``settings.ENTITIES``: names that 404 are reported as "not found" (fix the
list), names that resolve are sampled. For every field it reports the observed
type, how often it's null, low-cardinality value sets (enum candidates), and
whether values look like references to another entity's ids.

Use the output (``discovery/SCHEMA_REPORT.md`` + per-entity ``*.sample.json``)
to fill in the ``source=`` placeholders and enum/role maps.

Usage::

    cd backend && uv run python scripts/base44/discover.py
"""

import asyncio
import json
import sys
from pathlib import Path

# Make `src/` and the backend root importable (mirrors seed_dev.py).
_BACKEND_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_BACKEND_DIR / "src"))
sys.path.insert(0, str(_BACKEND_DIR))

from config import config  # noqa: E402
from scripts.base44 import settings  # noqa: E402
from scripts.base44.client import Base44Client, Base44Error  # noqa: E402

_HERE = Path(__file__).resolve().parent
_DISCOVERY_DIR = _HERE / "discovery"
_SAMPLE_LIMIT = 50
_MAX_DISTINCT = 12


def _field_stats(records: list[dict]) -> dict[str, dict]:
    stats: dict[str, dict] = {}
    for rec in records:
        for key, value in rec.items():
            slot = stats.setdefault(key, {"present": 0, "null": 0, "types": set(), "values": set()})
            slot["present"] += 1
            if value is None:
                slot["null"] += 1
                continue
            slot["types"].add(type(value).__name__)
            if isinstance(value, (str, int, bool, float)):
                slot["values"].add(value)
    return stats


def _looks_like_ref(values: set, id_sets: dict[str, set[str]], self_entity: str) -> str | None:
    str_values = {str(v) for v in values if isinstance(v, str)}
    if not str_values:
        return None
    for entity, ids in id_sets.items():
        if entity == self_entity or not ids:
            continue
        hits = len(str_values & ids)
        if hits and hits / len(str_values) >= 0.5:
            return entity
    return None


def _render_report(samples: dict[str, list[dict]], missing: list[str], errors: dict[str, str]) -> str:
    id_sets = {e: {str(r.get("id")) for r in recs if r.get("id") is not None} for e, recs in samples.items()}
    lines = ["# base44 — discovery report", ""]
    lines.append(f"App: `{config.BASE44_APP_ID or '(unset)'}`  ·  server: `{config.BASE44_API_URL}`")
    lines.append("")
    if missing:
        lines += ["## Entities not found (fix names in settings.ENTITIES)", ""]
        lines += [f"- `{name}`" for name in missing] + [""]
    if errors:
        lines += ["## Entities that errored", ""]
        lines += [f"- `{name}`: {msg}" for name, msg in errors.items()] + [""]
    for entity, records in samples.items():
        lines += [f"## {entity}  ({len(records)} sampled)", ""]
        if not records:
            lines += ["_no records_", ""]
            continue
        lines += ["| field | present | null | types | enum candidates / ref |", "| --- | --: | --: | --- | --- |"]
        for fieldname, slot in sorted(_field_stats(records).items()):
            types = ", ".join(sorted(slot["types"])) or "—"
            ref = _looks_like_ref(slot["values"], id_sets, entity)
            note = ""
            if ref:
                note = f"→ ref to **{ref}**"
            elif slot["types"] == {"str"} and 0 < len(slot["values"]) <= _MAX_DISTINCT:
                note = "enum? " + ", ".join(repr(v) for v in sorted(map(str, slot["values"])))
            lines.append(f"| `{fieldname}` | {slot['present']} | {slot['null']} | {types} | {note} |")
        lines.append("")
    return "\n".join(lines)


async def discover() -> None:
    _DISCOVERY_DIR.mkdir(parents=True, exist_ok=True)
    samples: dict[str, list[dict]] = {}
    missing: list[str] = []
    errors: dict[str, str] = {}

    async with Base44Client(
        server_url=config.BASE44_API_URL,
        app_id=config.BASE44_APP_ID,
        token=config.BASE44_API_TOKEN,
    ) as client:
        for entity in settings.ENTITIES:
            try:
                records = await client.sample(entity, limit=_SAMPLE_LIMIT)
            except Base44Error as exc:
                if " 404" in f" {exc}":
                    missing.append(entity)
                else:
                    errors[entity] = str(exc)
                print(f"  ✗ {entity}: {exc}")
                continue
            samples[entity] = records
            (_DISCOVERY_DIR / f"{entity}.sample.json").write_text(
                json.dumps(records, indent=2, default=str), encoding="utf-8"
            )
            print(f"  ✓ {entity}: {len(records)} sampled")

    report = _render_report(samples, missing, errors)
    (_DISCOVERY_DIR / "SCHEMA_REPORT.md").write_text(report, encoding="utf-8")
    print(f"\nWrote {_DISCOVERY_DIR / 'SCHEMA_REPORT.md'}")
    if missing:
        print(f"Not found (fix settings.ENTITIES): {', '.join(missing)}")


def main() -> None:
    if not config.BASE44_APP_ID or not config.BASE44_API_TOKEN:
        raise SystemExit("Set BASE44_APP_ID and BASE44_API_TOKEN in backend/.env first.")
    asyncio.run(discover())


if __name__ == "__main__":
    main()
