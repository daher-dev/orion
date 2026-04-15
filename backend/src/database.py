import re
import ssl
from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from config import config


def _requires_ssl(url: str) -> bool:
    """Check if the original DATABASE_URL requests SSL (e.g. managed Postgres)."""
    return "sslmode=require" in url or "sslmode=verify" in url


def _normalize_database_url(url: str) -> str:
    """Use postgresql+asyncpg for async driver. Strip sslmode (asyncpg uses ssl in connect_args)."""
    if not url or not url.strip():
        raise ValueError(
            "DATABASE_URL is empty. Set it in backend/.env. Example: postgresql://orion:orion@localhost:5433/orion_dev"
        )
    if url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    url = re.sub(r"[?&]sslmode=[^&]*", "", url)
    url = re.sub(r"[?&]channel_binding=[^&]*", "", url)
    return re.sub(r"\?&", "?", url).rstrip("?")


@lru_cache(maxsize=1)
def get_engine() -> AsyncEngine:
    raw_url = config.DATABASE_URL
    url = _normalize_database_url(raw_url)
    connect_args: dict = {}
    if _requires_ssl(raw_url):
        connect_args["ssl"] = ssl.create_default_context()
    return create_async_engine(
        url=url,
        echo=config.ENV == "dev",
        pool_pre_ping=True,
        connect_args=connect_args,
    )


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        bind=get_engine(),
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def get_db() -> AsyncGenerator[AsyncSession]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        yield session
