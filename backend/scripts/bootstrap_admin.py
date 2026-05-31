"""Bootstrap a company + its first admin user directly.

Since self-service onboarding was removed (login is invite-only), the very first
user of a company can't be created through the API — there's no admin yet to
invite them. This script seeds that bootstrap admin directly, the same way a
production operator would provision the founding account.

Idempotent: an existing company (by subdomain) is reused, and an existing
membership (by firebase_uid within that company) is left untouched.

Configuration via env vars (with E2E-friendly defaults)::

    BOOTSTRAP_FIREBASE_UID   (default: qa-dev-user)
    BOOTSTRAP_EMAIL          (default: qa-dev@orion.local)
    BOOTSTRAP_NAME           (default: QA Dev User)
    BOOTSTRAP_COMPANY_NAME   (default: QA E2E)
    BOOTSTRAP_SUBDOMAIN      (default: qae2e)
    BOOTSTRAP_MAIN_COLOR     (default: #2563eb)

Usage::

    cd backend && uv run python scripts/bootstrap_admin.py
"""

import asyncio
import os
import sys
import uuid
from pathlib import Path

# Make `src/` importable when run as `python scripts/bootstrap_admin.py`.
_BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_BACKEND_DIR / "src"))
sys.path.insert(0, str(_BACKEND_DIR))

from sqlmodel import select  # noqa: E402
from sqlmodel.ext.asyncio.session import AsyncSession  # noqa: E402

from database import get_session_factory  # noqa: E402
from models import Company, Role, User  # noqa: E402


async def _get_or_create_company(db: AsyncSession, *, name: str, subdomain: str, main_color: str) -> Company:
    existing = (await db.exec(select(Company).where(Company.subdomain == subdomain))).first()
    if existing is not None:
        return existing
    company = Company(name=name, subdomain=subdomain, main_color=main_color)
    db.add(company)
    await db.flush()
    return company


async def bootstrap() -> uuid.UUID:
    firebase_uid = os.environ.get("BOOTSTRAP_FIREBASE_UID", "qa-dev-user")
    email = os.environ.get("BOOTSTRAP_EMAIL", "qa-dev@orion.local")
    name = os.environ.get("BOOTSTRAP_NAME", "QA Dev User")
    company_name = os.environ.get("BOOTSTRAP_COMPANY_NAME", "QA E2E")
    subdomain = os.environ.get("BOOTSTRAP_SUBDOMAIN", "qae2e")
    main_color = os.environ.get("BOOTSTRAP_MAIN_COLOR", "#2563eb")

    factory = get_session_factory()
    async with factory() as db:
        admin_role = (await db.exec(select(Role).where(Role.code == "admin"))).first()
        if admin_role is None:
            raise RuntimeError("Admin role not seeded — run migrations first (alembic upgrade head).")

        company = await _get_or_create_company(db, name=company_name, subdomain=subdomain, main_color=main_color)

        existing_user = (
            await db.exec(
                select(User).where(
                    User.firebase_uid == firebase_uid,
                    User.company_id == company.id,
                )
            )
        ).first()
        if existing_user is None:
            db.add(
                User(
                    company_id=company.id,
                    firebase_uid=firebase_uid,
                    name=name,
                    email=email,
                    role_id=admin_role.id,
                )
            )
        await db.commit()
        return company.id


def main() -> None:
    company_id = asyncio.run(bootstrap())
    print(f"Bootstrapped admin {os.environ.get('BOOTSTRAP_FIREBASE_UID', 'qa-dev-user')} in company {company_id}")


if __name__ == "__main__":
    main()
