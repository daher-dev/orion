import asyncio
import re
import ssl
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from sqlmodel import SQLModel  # noqa: E402

from config import config as app_config  # noqa: E402

import models  # noqa: E402, F401 — register table models with SQLModel.metadata

config = context.config
raw_url = app_config.DATABASE_URL
_use_ssl = "sslmode=require" in raw_url or "sslmode=verify" in raw_url
url = raw_url
if url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
    url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
url = re.sub(r"[?&]sslmode=[^&]*", "", url)
url = re.sub(r"[?&]channel_binding=[^&]*", "", url)
url = re.sub(r"\?&", "?", url).rstrip("?")
config.set_main_option("sqlalchemy.url", url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connect_args: dict = {}
    if _use_ssl:
        connect_args["ssl"] = ssl.create_default_context()
    connectable = create_async_engine(
        config.get_main_option("sqlalchemy.url"),
        connect_args=connect_args,
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
