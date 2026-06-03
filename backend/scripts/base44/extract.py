"""PHASE 1 — pull every base44 entity to ``raw/<Entity>.json``.

Pure I/O: no transformation happens here, so the dumps can be re-converted
offline (``import_base44.py --from-files``) while iterating on mappings.

Usage::

    cd backend && uv run python scripts/base44/extract.py
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
RAW_DIR = _HERE / "raw"


async def extract_all(client: Base44Client) -> dict[str, list[dict]]:
    """Fetch every configured entity. Missing entities (404) are skipped."""
    out: dict[str, list[dict]] = {}
    for entity in settings.ENTITIES:
        try:
            records = await client.list_records(entity)
        except Base44Error as exc:
            if " 404" in f" {exc}":
                print(f"  · {entity}: not found, skipped")
                continue
            raise
        out[entity] = records
        print(f"  ✓ {entity}: {len(records)}")
    return out


def write_raw(data: dict[str, list[dict]]) -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for entity, records in data.items():
        (RAW_DIR / f"{entity}.json").write_text(json.dumps(records, indent=2, default=str), encoding="utf-8")


def read_raw() -> dict[str, list[dict]]:
    """Load previously-extracted dumps from disk (for --from-files)."""
    if not RAW_DIR.exists():
        raise SystemExit(f"No raw dumps at {RAW_DIR}. Run extract first (drop --from-files).")
    data: dict[str, list[dict]] = {}
    for path in sorted(RAW_DIR.glob("*.json")):
        data[path.stem] = json.loads(path.read_text(encoding="utf-8"))
    return data


async def _run() -> None:
    async with Base44Client(
        server_url=config.BASE44_API_URL,
        app_id=config.BASE44_APP_ID,
        token=config.BASE44_API_TOKEN,
    ) as client:
        data = await extract_all(client)
    write_raw(data)
    total = sum(len(v) for v in data.values())
    print(f"\nWrote {len(data)} entities ({total} records) to {RAW_DIR}")


def main() -> None:
    if not config.BASE44_APP_ID or not config.BASE44_API_TOKEN:
        raise SystemExit("Set BASE44_APP_ID and BASE44_API_TOKEN in backend/.env first.")
    asyncio.run(_run())


if __name__ == "__main__":
    main()
