"""add channel_connection table and integrations permissions

Creates the ``channel_connections`` table (one per-company marketplace channel
connection) plus the new ``channel_status`` Postgres enum. Reuses the existing
``ecommerce`` enum for the ``channel`` column WITHOUT re-creating the type.

Also seeds the ``integrations.read`` / ``integrations.write`` permission codes
and grants them: both to the global ``admin`` role, read-only to ``manager``
(operator gets neither). Mirrors the seed pattern in
``2a6589a47ac1_seed_reports_permissions.py`` — looks roles up by code, never
hardcodes seed-migration uuids, and is safe to re-run.

Revision ID: efc19fe7309e
Revises: 2a6589a47ac1
Create Date: 2026-06-09 00:38:35.990991

"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "efc19fe7309e"
down_revision: str | Sequence[str] | None = "2a6589a47ac1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# New enum type created by this migration.
CHANNEL_STATUS = postgresql.ENUM("available", "connected", "error", name="channel_status", create_type=False)
# Existing enum — referenced WITHOUT creating the type (already in the DB).
ECOMMERCE = postgresql.ENUM(
    "shopee",
    "mercado_livre",
    "shopify",
    "instagram",
    "whatsapp",
    "other",
    name="ecommerce",
    create_type=False,
)

# New permission domain seeded + granted by this migration.
NEW_PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("integrations.read", "Read: Marketplace channel integrations"),
    ("integrations.write", "Write: Marketplace channel integrations"),
)
# (role_code, [permission codes granted to that role]).
GRANTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("admin", ("integrations.read", "integrations.write")),
    ("manager", ("integrations.read",)),
)
_ALL_NEW_CODES = tuple(code for code, _ in NEW_PERMISSIONS)


def upgrade() -> None:
    bind = op.get_bind()

    # --- 1. schema: enum + table ---
    CHANNEL_STATUS.create(bind, checkfirst=True)

    op.create_table(
        "channel_connections",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("channel", ECOMMERCE, nullable=False),
        sa.Column("status", CHANNEL_STATUS, nullable=False),
        sa.Column("access_token", sqlmodel.sql.sqltypes.AutoString(length=2048), nullable=True),
        sa.Column("refresh_token", sqlmodel.sql.sqltypes.AutoString(length=2048), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("external_account_id", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True),
        sa.Column("scopes", sqlmodel.sql.sqltypes.AutoString(length=1024), nullable=True),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name=op.f("fk_channel_connections_company_id_companies"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_channel_connections")),
        sa.UniqueConstraint("company_id", "channel", name="uq_channel_connections_company_id_channel"),
    )
    op.create_index(
        op.f("ix_channel_connections_company_id"),
        "channel_connections",
        ["company_id"],
        unique=False,
    )

    # --- 2. permissions seed + grants (idempotent) ---
    permissions_table = sa.table(
        "permissions",
        sa.column("id", sa.Uuid()),
        sa.column("code", sa.String()),
        sa.column("description", sa.String()),
    )
    role_permissions_table = sa.table(
        "role_permissions",
        sa.column("role_id", sa.Uuid()),
        sa.column("permission_id", sa.Uuid()),
    )

    existing_codes = {
        row[0]
        for row in bind.execute(
            sa.text("SELECT code FROM permissions WHERE code IN ('integrations.read', 'integrations.write')")
        )
    }
    permission_ids: dict[str, uuid.UUID] = {}
    new_rows = []
    for code, description in NEW_PERMISSIONS:
        if code in existing_codes:
            pid = bind.execute(
                sa.text("SELECT id FROM permissions WHERE code = :code"),
                {"code": code},
            ).scalar()
            permission_ids[code] = pid
            continue
        pid = uuid.uuid4()
        permission_ids[code] = pid
        new_rows.append({"id": pid, "code": code, "description": description})
    if new_rows:
        op.bulk_insert(permissions_table, new_rows)

    grant_rows = []
    for role_code, codes in GRANTS:
        role_id = bind.execute(
            sa.text("SELECT id FROM roles WHERE code = :code AND company_id IS NULL"),
            {"code": role_code},
        ).scalar()
        if role_id is None:
            continue
        for code in codes:
            already = bind.execute(
                sa.text("SELECT 1 FROM role_permissions WHERE role_id = :rid AND permission_id = :pid"),
                {"rid": role_id, "pid": permission_ids[code]},
            ).first()
            if already is None:
                grant_rows.append({"role_id": role_id, "permission_id": permission_ids[code]})
    if grant_rows:
        op.bulk_insert(role_permissions_table, grant_rows)


def downgrade() -> None:
    # Remove permission grants + codes first (leave every other perm intact).
    placeholders = ", ".join(f"'{c}'" for c in _ALL_NEW_CODES)
    op.execute(
        f"DELETE FROM role_permissions WHERE permission_id IN "
        f"(SELECT id FROM permissions WHERE code IN ({placeholders}))"
    )
    op.execute(f"DELETE FROM permissions WHERE code IN ({placeholders})")

    # Drop the table, then the enum type it owned.
    op.drop_index(op.f("ix_channel_connections_company_id"), table_name="channel_connections")
    op.drop_table("channel_connections")
    CHANNEL_STATUS.drop(op.get_bind(), checkfirst=True)
