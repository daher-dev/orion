"""Orchestrator — extract → convert → load, with a reconciliation report.

Multi-tenant: imports every base44 company into its own Orion company. Idempotent
(deterministic ids + per-company wipe-and-reload), so it's safe to run repeatedly
during validation and once at cutover.

Usage::

    cd backend && uv run python scripts/base44/import_base44.py              # extract + load
    cd backend && uv run python scripts/base44/import_base44.py --from-files # reuse raw/ dumps
    cd backend && uv run python scripts/base44/import_base44.py --dry-run     # convert only, no writes

Env: BASE44_APP_ID, BASE44_API_TOKEN (unless --from-files), BASE44_API_URL.
"""

import argparse
import asyncio
import sys
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_BACKEND_DIR / "src"))
sys.path.insert(0, str(_BACKEND_DIR))

from config import config  # noqa: E402
from database import get_session_factory  # noqa: E402
from scripts.base44.client import Base44Client  # noqa: E402
from scripts.base44.extract import extract_all, read_raw, write_raw  # noqa: E402
from scripts.base44.load import load  # noqa: E402
from scripts.base44.mappings import ConversionReport, convert  # noqa: E402
from scripts.base44.rehost_images import rehost_images  # noqa: E402

_REPORT_PATH = Path(__file__).resolve().parent / "last_run_report.md"


async def _extract() -> dict[str, list[dict]]:
    if not config.BASE44_APP_ID or not config.BASE44_API_TOKEN:
        raise SystemExit("Set BASE44_APP_ID and BASE44_API_TOKEN (or pass --from-files).")
    print("Extracting from base44…")
    async with Base44Client(
        server_url=config.BASE44_API_URL,
        app_id=config.BASE44_APP_ID,
        token=config.BASE44_API_TOKEN,
    ) as client:
        data = await extract_all(client)
    write_raw(data)
    return data


async def run(
    *,
    from_files: bool,
    dry_run: bool,
    link_users: str | None = None,
    exclude_companies: list[str] | None = None,
    rehost: bool = False,
) -> None:
    raw = read_raw() if from_files else await _extract()

    report = ConversionReport()
    data = convert(raw, report=report, exclude_company_names=set(exclude_companies or []))
    print(f"Converted {len(data.companies)} companies, {len(data.users)} users.")

    if dry_run:
        print("DRY RUN — no database writes.")
    else:
        factory = get_session_factory()
        async with factory() as db:
            await load(db, data=data, report=report, link_users_subdomain=link_users)
            await db.commit()
        print("Loaded into the database.")

        if rehost:
            print("Re-hosting base44 images onto Firebase Storage…")
            async with factory() as db:
                counts = await rehost_images(db, company_ids=data.company_ids)
                await db.commit()
            print(f"  rehosted={counts['rehosted']} skipped={counts['skipped']} failed={counts['failed']}")

    _REPORT_PATH.write_text(report.render_markdown(), encoding="utf-8")
    print(f"\nReport: {_REPORT_PATH}")
    for key, n in report.created.items():
        print(f"  {key}: created={n} inserted={report.inserted.get(key, 0)}")
    skipped = sum(report.skipped.values())
    if skipped:
        print(f"  skipped rows: {skipped} (see report)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import base44 data into Orion (all companies).")
    parser.add_argument("--from-files", action="store_true", help="convert saved raw/ dumps instead of re-extracting")
    parser.add_argument("--dry-run", action="store_true", help="convert + validate only; no database writes")
    parser.add_argument(
        "--link-existing-users",
        metavar="SUBDOMAIN",
        default=None,
        help="after load, add every pre-existing real user as a member of this company (e.g. underground)",
    )
    parser.add_argument(
        "--exclude-company",
        metavar="NAME",
        action="append",
        default=None,
        help="base44 company name to skip entirely (repeatable), e.g. --exclude-company 'Empresa Teste'",
    )
    parser.add_argument(
        "--rehost-images",
        action="store_true",
        help="after load, download base44-hosted artwork and re-upload it to Firebase Storage",
    )
    args = parser.parse_args()
    asyncio.run(
        run(
            from_files=args.from_files,
            dry_run=args.dry_run,
            link_users=args.link_existing_users,
            exclude_companies=args.exclude_company,
            rehost=args.rehost_images,
        )
    )


if __name__ == "__main__":
    main()
