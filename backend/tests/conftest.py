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


async def _truncate_all(session: AsyncSession) -> None:
    """Truncate every user-created table — schema-agnostic."""
    # Use the underlying connection to avoid SQLModel's execute() deprecation warning for raw SQL.
    conn = await session.connection()
    result = await conn.execute(
        text("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'alembic_version'")
    )
    tables = [row[0] for row in result]
    if not tables:
        return
    quoted = ", ".join(f'"{t}"' for t in tables)
    await conn.execute(text(f"TRUNCATE {quoted} RESTART IDENTITY CASCADE"))
    await session.commit()


@pytest.fixture(autouse=True)
async def db_session(test_session_factory) -> AsyncGenerator[AsyncSession]:
    """Provides a clean DB session per test, truncating all tables after each test."""
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
