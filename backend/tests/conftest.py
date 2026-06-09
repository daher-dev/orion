import os
import ssl
from collections.abc import AsyncGenerator
from pathlib import Path

import httpx
import pytest
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from sqlmodel.ext.asyncio.session import AsyncSession

os.environ.setdefault("ENV", "test")

# Load .env from the backend directory so DATABASE_URL is available
_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env", override=False)

from database import _normalize_database_url  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def test_engine():
    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        pytest.skip("DATABASE_URL not set")
    normalized_url = _normalize_database_url(database_url)
    connect_args: dict = {}
    if "sslmode=require" in database_url or "sslmode=verify" in database_url:
        connect_args["ssl"] = ssl.create_default_context()
    engine = create_async_engine(
        url=normalized_url,
        echo=False,
        connect_args=connect_args,
        poolclass=NullPool,
    )
    yield engine
    await engine.dispose()


@pytest.fixture
async def test_session_factory(test_engine):
    yield async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


# Reference tables seeded by Alembic migrations — preserved between tests.
# `permissions` has no FK to `companies`, so it survives a `TRUNCATE companies
# CASCADE`. `roles` now carries a nullable `company_id` FK to `companies`
# (custom per-company roles), so truncating `companies` cascades into `roles`
# AND `role_permissions` regardless of the FK's ondelete action — TRUNCATE
# CASCADE ignores ondelete semantics. We therefore re-seed the 3 global roles
# and their permission links after each truncate (see `_reseed_global_roles`).
_SEED_TABLES: frozenset[str] = frozenset({"roles", "permissions", "role_permissions"})

# Imported lazily inside the helper to avoid pulling Alembic at collection time.
_GLOBAL_ROLE_CODES = ("admin", "manager", "operator")


async def _reseed_global_roles(conn) -> None:
    """Restore the 3 global seeded roles + their permission links.

    `permissions` survives truncation (no FK to companies), so we only rebuild
    `roles` (company_id NULL) and `role_permissions` from the migration's
    canonical catalog. Idempotent: skips re-seeding when the globals are present.
    """
    from seed_catalog import GLOBAL_ROLE_SPECS  # canonical seed catalog (shared with migration)

    existing = await conn.execute(
        text("SELECT count(*) FROM roles WHERE company_id IS NULL AND code IN ('admin', 'manager', 'operator')")
    )
    if int(existing.scalar() or 0) >= len(_GLOBAL_ROLE_CODES):
        return

    # Map permission code -> id from the surviving permissions table.
    perm_rows = await conn.execute(text("SELECT id, code FROM permissions"))
    perm_id_by_code = {code: pid for pid, code in perm_rows.fetchall()}

    for code, name, description, perm_codes in GLOBAL_ROLE_SPECS:
        await conn.execute(
            text(
                "INSERT INTO roles (id, code, name, description, company_id) "
                "VALUES (gen_random_uuid(), :code, :name, :description, NULL) "
                "ON CONFLICT (company_id, code) DO NOTHING"
            ),
            {"code": code, "name": name, "description": description},
        )
        rid_row = await conn.execute(
            text("SELECT id FROM roles WHERE company_id IS NULL AND code = :code"),
            {"code": code},
        )
        rid = rid_row.scalar()
        for perm_code in perm_codes:
            pid = perm_id_by_code.get(perm_code)
            if pid is None:
                continue
            await conn.execute(
                text(
                    "INSERT INTO role_permissions (role_id, permission_id) VALUES (:rid, :pid) ON CONFLICT DO NOTHING"
                ),
                {"rid": rid, "pid": pid},
            )


async def _truncate_all(session: AsyncSession) -> None:
    """Truncate every user-created table, preserving seeded reference data.

    Truncating `companies` cascades into the (now FK-linked) `roles` table, so
    after the truncate we re-seed the 3 global roles. Tests may also add NEW
    rows to seeded tables (custom per-company roles); those are swept by the
    same cascade, and only the globals are restored.
    """
    conn = await session.connection()
    result = await conn.execute(
        text("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'alembic_version'")
    )
    tables = [row[0] for row in result if row[0] not in _SEED_TABLES]
    if tables:
        quoted = ", ".join(f'"{t}"' for t in tables)
        await conn.execute(text(f"TRUNCATE {quoted} RESTART IDENTITY CASCADE"))
    # Sweep any test-added custom roles left over (defensive — most are removed
    # by the companies cascade), then restore the global seeded roles.
    await conn.execute(text("DELETE FROM roles WHERE code NOT IN ('admin', 'manager', 'operator')"))
    await _reseed_global_roles(conn)
    await session.commit()


@pytest.fixture(autouse=True)
async def db_session(test_session_factory) -> AsyncGenerator[AsyncSession]:
    """Provides a clean DB session per test, truncating all tables after each test.

    The global seeded roles are restored on teardown, but we also ensure they
    exist *before* the first test runs (idempotent) so a run that starts against
    an emptied `roles` table — e.g. after a manual truncate — still has them.
    """
    async with test_session_factory() as setup_session:
        await _reseed_global_roles(await setup_session.connection())
        await setup_session.commit()

    async with test_session_factory() as session:
        yield session
        if session.in_transaction():
            await session.rollback()

    async with test_session_factory() as cleanup_session:
        await _truncate_all(cleanup_session)


@pytest.fixture(autouse=True)
def _override_db_dependency(db_session: AsyncSession):
    from database import get_db

    async def _override():
        yield db_session

    app.dependency_overrides[get_db] = _override
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
async def async_client() -> AsyncGenerator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {
        "X-Dev-Bypass-Uid": "qa-dev-user",
        "X-Dev-Bypass-Name": "QA Dev User",
        "X-Dev-Bypass-Email": "qa-dev@orion.local",
    }


@pytest.fixture
async def authed_client(
    async_client: httpx.AsyncClient,
    auth_headers: dict[str, str],
) -> AsyncGenerator[httpx.AsyncClient]:
    async_client.headers.update(auth_headers)
    yield async_client
