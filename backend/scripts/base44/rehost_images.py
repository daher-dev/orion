"""Re-host base44-hosted artwork PNGs onto Firebase Storage.

Base44 is being retired, so every image column that still points at a base44
host (``base44.app`` / ``media.base44.com``) must have its bytes downloaded and
re-uploaded to our own bucket, with the column rewritten to the new URL.

The module is **idempotent and resumable**:

  * Only values whose host is base44 are touched. Anything already pointing at
    our bucket (or a ``local://`` dev fallback, or any non-base44 CDN) is left
    alone — so a second run is a no-op for already-migrated rows.
  * Each image is wrapped in try/except; on failure the original base44 URL is
    left in place so a later run retries just that one row.
  * Downloads are de-duplicated by source URL (many estampa combos share the
    same PNG): each unique source is fetched + uploaded exactly once.

When ``FIREBASE_STORAGE_BUCKET`` is unset, :func:`artwork._upload_to_bucket`
returns a ``local://artwork/...`` URL — the script still runs end-to-end and
rewrites to those local URLs, which then read as "not a base44 host" on a later
run, preserving idempotency.

Columns processed:

    print_designs:           image_url, image_url_front, image_url_back
    print_design_variations: front_file_url, back_file_url

Usage::

    cd backend && uv run python scripts/base44/rehost_images.py             # all companies
    cd backend && uv run python scripts/base44/rehost_images.py --company <uuid>  # repeatable
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from pathlib import Path
from urllib.parse import urlsplit

_BACKEND_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_BACKEND_DIR / "src"))
sys.path.insert(0, str(_BACKEND_DIR))

import httpx  # noqa: E402
from sqlalchemy import update  # noqa: E402
from sqlmodel import select  # noqa: E402
from sqlmodel.ext.asyncio.session import AsyncSession  # noqa: E402

from database import get_session_factory  # noqa: E402
from firebase import init_firebase  # noqa: E402
from logger import get_logger  # noqa: E402
from models import PrintDesign, PrintDesignVariation  # noqa: E402
from services import artwork  # noqa: E402

logger = get_logger(__name__)

# Hosts whose images still live on base44 and must be migrated. Anything else
# (our bucket, a local:// fallback, another CDN) is considered already-hosted.
_BASE44_HOSTS = frozenset({"base44.app", "media.base44.com", "www.base44.com"})

_DOWNLOAD_TIMEOUT = 60.0


def _is_base44_url(value: str | None) -> bool:
    """True only for non-empty URLs whose host is a known base44 host."""
    if not value:
        return False
    host = urlsplit(value).hostname
    return host is not None and host.lower() in _BASE44_HOSTS


def _design_object_path(*, company_id: uuid.UUID, print_id: uuid.UUID, slot: str) -> str:
    """Bucket path for a print_design column. Mirrors ``artwork._object_path``'s shape.

    ``slot`` is one of ``thumbnail`` / ``front`` / ``back``.
    """
    return f"companies/{company_id}/prints/{print_id}/{slot}.png"


class _Rehoster:
    """Downloads + re-uploads base44 images, caching by source URL."""

    def __init__(self, db: AsyncSession, http: httpx.AsyncClient) -> None:
        self._db = db
        self._http = http
        # src_url -> downloaded bytes, so each unique source is fetched once even
        # when it feeds several destination columns (thumbnail/front/back, or a
        # design thumbnail that is also a variation's artwork). The upload itself
        # still runs per destination ``object_path`` so each column lands at its
        # own bucket key.
        self._bytes_cache: dict[str, bytes] = {}
        self.rehosted = 0
        self.skipped = 0
        self.failed = 0

    async def _migrate_value(self, *, value: str | None, object_path: str) -> str | None:
        """Return the rewritten URL for ``value``, or the original on skip/failure.

        Skips non-base44 values (already hosted). On download/upload failure the
        original base44 URL is returned so a later run can retry it.
        """
        if not _is_base44_url(value):
            self.skipped += 1
            return value

        assert value is not None  # narrowed by _is_base44_url
        try:
            data = self._bytes_cache.get(value)
            if data is None:
                resp = await self._http.get(value, follow_redirects=True)
                resp.raise_for_status()
                data = resp.content
                self._bytes_cache[value] = data
            hosted_url = artwork._upload_to_bucket(object_path=object_path, data=data)
        except Exception:
            self.failed += 1
            logger.exception("rehost failed; leaving base44 url in place", extra={"source_url": value})
            return value

        self.rehosted += 1
        return hosted_url

    async def process_designs(self, company_ids: list[uuid.UUID] | None) -> None:
        stmt = select(PrintDesign)
        if company_ids is not None:
            stmt = stmt.where(PrintDesign.company_id.in_(company_ids))
        designs = (await self._db.exec(stmt)).all()

        for design in designs:
            updates: dict[str, str | None] = {}
            for column, slot in (
                ("image_url", "thumbnail"),
                ("image_url_front", "front"),
                ("image_url_back", "back"),
            ):
                current = getattr(design, column)
                new_value = await self._migrate_value(
                    value=current,
                    object_path=_design_object_path(
                        company_id=design.company_id, print_id=design.id, slot=slot
                    ),
                )
                if new_value != current:
                    updates[column] = new_value
            if updates:
                await self._db.exec(
                    update(PrintDesign).where(PrintDesign.id == design.id).values(**updates)
                )

    async def process_variations(self, company_ids: list[uuid.UUID] | None) -> None:
        stmt = select(PrintDesignVariation)
        if company_ids is not None:
            stmt = stmt.where(PrintDesignVariation.company_id.in_(company_ids))
        variations = (await self._db.exec(stmt)).all()

        for variation in variations:
            updates: dict[str, str | None] = {}
            for column, side in (("front_file_url", "front"), ("back_file_url", "back")):
                current = getattr(variation, column)
                new_value = await self._migrate_value(
                    value=current,
                    object_path=artwork._object_path(
                        company_id=variation.company_id,
                        print_id=variation.print_design_id,
                        variation_id=variation.id,
                        side=side,
                    ),
                )
                if new_value != current:
                    updates[column] = new_value
            if updates:
                await self._db.exec(
                    update(PrintDesignVariation)
                    .where(PrintDesignVariation.id == variation.id)
                    .values(**updates)
                )


async def rehost_images(db: AsyncSession, *, company_ids: list[uuid.UUID] | None = None) -> dict:
    """Re-host every base44-hosted artwork image onto Firebase Storage.

    Scans ``print_designs`` (image_url / image_url_front / image_url_back) and
    ``print_design_variations`` (front_file_url / back_file_url). For each value
    whose host is base44, downloads the bytes and re-uploads via
    :func:`artwork._upload_to_bucket`, rewriting the column. Does NOT commit —
    the caller owns the transaction.

    :param company_ids: when given, restrict to these companies; otherwise all.
    :returns: ``{"rehosted": int, "skipped": int, "failed": int}``.
    """
    # Ensure Firebase Admin is initialized (ADC + projectId + storageBucket from
    # config) so ``artwork._upload_to_bucket`` can resolve the bucket. Idempotent.
    init_firebase()

    async with httpx.AsyncClient(timeout=_DOWNLOAD_TIMEOUT) as http:
        rehoster = _Rehoster(db, http)
        await rehoster.process_designs(company_ids)
        await rehoster.process_variations(company_ids)

    counts = {
        "rehosted": rehoster.rehosted,
        "skipped": rehoster.skipped,
        "failed": rehoster.failed,
    }
    logger.info("rehost complete", extra=counts)
    return counts


async def _run(company_ids: list[uuid.UUID] | None) -> None:
    factory = get_session_factory()
    async with factory() as db:
        counts = await rehost_images(db, company_ids=company_ids)
        await db.commit()
    print(
        f"Rehosted: rehosted={counts['rehosted']} "
        f"skipped={counts['skipped']} failed={counts['failed']}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Re-host base44-hosted artwork images onto Firebase Storage."
    )
    parser.add_argument(
        "--company",
        metavar="UUID",
        action="append",
        default=None,
        help="restrict to this company id (repeatable); default: all companies",
    )
    args = parser.parse_args()
    company_ids = [uuid.UUID(c) for c in args.company] if args.company else None
    asyncio.run(_run(company_ids))


if __name__ == "__main__":
    main()
