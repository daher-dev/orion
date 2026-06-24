"""Provision N isolated tenants for parallel Playwright E2E workers.

Each Playwright worker authenticates as a distinct dev-bypass identity
(``qa-dev-user-<i>``) living in its own company, so workers can seed + reset
their tenant in parallel without colliding (the reset endpoint is tenant-scoped).

Idempotent: existing companies (by subdomain) and memberships (by firebase_uid)
are reused. Run after migrations.

Configuration::

    E2E_WORKER_COUNT   number of tenants to create (default: 4)

Usage::

    cd backend && E2E_WORKER_COUNT=4 uv run python scripts/bootstrap_e2e_tenants.py
"""

import asyncio
import os
import sys
from pathlib import Path

# Make `src/` importable when run as `python scripts/bootstrap_e2e_tenants.py`.
_BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_BACKEND_DIR / "src"))
sys.path.insert(0, str(_BACKEND_DIR))

from sqlmodel import select  # noqa: E402
from sqlmodel.ext.asyncio.session import AsyncSession  # noqa: E402

from database import get_session_factory  # noqa: E402
from models import Company, Role, User  # noqa: E402

# Mirror the per-worker identity the E2E support module derives
# (frontend/e2e/_support.ts) from Playwright's TEST_PARALLEL_INDEX.
UID_PREFIX = "qa-dev-user-"


async def _provision(db: AsyncSession, *, index: int, admin_role_id) -> None:
    subdomain = f"qae2e-{index}"
    company = (await db.exec(select(Company).where(Company.subdomain == subdomain))).first()
    if company is None:
        company = Company(name=f"QA E2E {index}", subdomain=subdomain, main_color="#2563eb")
        db.add(company)
        await db.flush()

    uid = f"{UID_PREFIX}{index}"
    existing = (await db.exec(select(User).where(User.firebase_uid == uid, User.company_id == company.id))).first()
    if existing is None:
        db.add(
            User(
                company_id=company.id,
                firebase_uid=uid,
                name=f"QA Dev User {index}",
                email=f"qa-dev-{index}@orion.local",
                role_id=admin_role_id,
            )
        )


async def bootstrap_tenants() -> int:
    count = int(os.environ.get("E2E_WORKER_COUNT", "4"))
    factory = get_session_factory()
    async with factory() as db:
        admin_role = (await db.exec(select(Role).where(Role.code == "admin"))).first()
        if admin_role is None:
            raise RuntimeError("Admin role not seeded — run migrations first (alembic upgrade head).")
        for index in range(count):
            await _provision(db, index=index, admin_role_id=admin_role.id)
        await db.commit()
    return count


def main() -> None:
    count = asyncio.run(bootstrap_tenants())
    print(f"Provisioned {count} E2E tenants: {UID_PREFIX}0 … {UID_PREFIX}{count - 1}")


if __name__ == "__main__":
    main()
