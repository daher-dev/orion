"""add billing plans and subscriptions

Creates the GLOBAL ``plans`` catalog table and the per-company ``subscriptions``
table (one subscription per company), plus the new ``subscription_status``
Postgres enum.

Seeds the ``billing.read`` / ``billing.write`` permission codes and grants them:
both to the global ``admin`` role, read-only to ``manager`` and ``operator``.
Mirrors the seed pattern in ``efc19fe7309e`` / ``2a6589a47ac1`` — looks roles up
by code, never hardcodes seed-migration uuids, and is safe to re-run.

Finally seeds the 4 design plans (Grátis / Ateliê / Pro / Fábrica) matching
``docs/design/admin/data.js`` so a fresh company resolves to the default
``free`` plan via the lazy default in ``services/billing.py``.

Revision ID: 6d396bf4bc50
Revises: efc19fe7309e
Create Date: 2026-06-09 01:18:13.237246

"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6d396bf4bc50"
down_revision: str | Sequence[str] | None = "efc19fe7309e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# New enum type created by this migration (create_type=False — we create it
# explicitly with checkfirst below so the inline column reference never emits a
# duplicate CREATE TYPE).
SUBSCRIPTION_STATUS = postgresql.ENUM(
    "active",
    "trialing",
    "past_due",
    "paused",
    "cancelled",
    "free",
    name="subscription_status",
    create_type=False,
)

# New permission domain seeded + granted by this migration.
NEW_PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("billing.read", "Read: Plans, subscription and billing"),
    ("billing.write", "Write: Plans, subscription and billing"),
)
# (role_code, [permission codes granted to that role]).
GRANTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("admin", ("billing.read", "billing.write")),
    ("manager", ("billing.read",)),
    ("operator", ("billing.read",)),
)
_ALL_NEW_CODES = tuple(code for code, _ in NEW_PERMISSIONS)

# The 4 catalog plans (matches docs/design/admin/data.js limits). NULL == unlimited.
# (slug, name, tagline, price_cents, max_members, max_orders_per_month,
#  max_integrations, max_storage_gb, sort_order)
SEED_PLANS: tuple[tuple[str, str, str, int, int | None, int | None, int | None, int | None, int], ...] = (
    ("free", "Grátis", "Para testar a operação", 0, 2, 50, 1, 1, 0),
    ("atelie", "Ateliê", "Marcas pequenas e ateliês", 7900, 5, 500, 3, 5, 1),
    ("pro", "Pro", "Confecções em crescimento", 14900, 10, 5000, 8, 10, 2),
    ("fabrica", "Fábrica", "Alto volume e múltiplas bancas", 34900, None, None, None, 50, 3),
)


def upgrade() -> None:
    bind = op.get_bind()

    # --- 1. enum ---
    SUBSCRIPTION_STATUS.create(bind, checkfirst=True)

    # --- 2. plans (global catalog) ---
    op.create_table(
        "plans",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("slug", sqlmodel.sql.sqltypes.AutoString(length=40), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=80), nullable=False),
        sa.Column("tagline", sqlmodel.sql.sqltypes.AutoString(length=160), nullable=True),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sqlmodel.sql.sqltypes.AutoString(length=3), nullable=False),
        sa.Column("max_members", sa.Integer(), nullable=True),
        sa.Column("max_orders_per_month", sa.Integer(), nullable=True),
        sa.Column("max_integrations", sa.Integer(), nullable=True),
        sa.Column("max_storage_gb", sa.Integer(), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.CheckConstraint(
            "max_integrations IS NULL OR max_integrations >= 0",
            name=op.f("ck_plans_max_integrations_non_negative"),
        ),
        sa.CheckConstraint(
            "max_members IS NULL OR max_members >= 0", name=op.f("ck_plans_max_members_non_negative")
        ),
        sa.CheckConstraint(
            "max_orders_per_month IS NULL OR max_orders_per_month >= 0",
            name=op.f("ck_plans_max_orders_per_month_non_negative"),
        ),
        sa.CheckConstraint(
            "max_storage_gb IS NULL OR max_storage_gb >= 0", name=op.f("ck_plans_max_storage_gb_non_negative")
        ),
        sa.CheckConstraint("price_cents >= 0", name=op.f("ck_plans_price_cents_non_negative")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_plans")),
    )
    op.create_index(op.f("ix_plans_slug"), "plans", ["slug"], unique=True)

    # --- 3. subscriptions (per company) ---
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("plan_id", sa.Uuid(), nullable=False),
        sa.Column("status", SUBSCRIPTION_STATUS, nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_subscriptions_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["plan_id"], ["plans.id"], name=op.f("fk_subscriptions_plan_id_plans"), ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_subscriptions")),
        sa.UniqueConstraint("company_id", name="uq_subscriptions_company_id"),
    )
    op.create_index(op.f("ix_subscriptions_company_id"), "subscriptions", ["company_id"], unique=False)
    op.create_index(op.f("ix_subscriptions_plan_id"), "subscriptions", ["plan_id"], unique=False)

    # --- 4. permissions seed + grants (idempotent) ---
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
            sa.text("SELECT code FROM permissions WHERE code IN ('billing.read', 'billing.write')")
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

    # --- 5. seed the 4 catalog plans (idempotent on slug) ---
    plans_seed_table = sa.table(
        "plans",
        sa.column("id", sa.Uuid()),
        sa.column("slug", sa.String()),
        sa.column("name", sa.String()),
        sa.column("tagline", sa.String()),
        sa.column("price_cents", sa.Integer()),
        sa.column("currency", sa.String()),
        sa.column("max_members", sa.Integer()),
        sa.column("max_orders_per_month", sa.Integer()),
        sa.column("max_integrations", sa.Integer()),
        sa.column("max_storage_gb", sa.Integer()),
        sa.column("is_public", sa.Boolean()),
        sa.column("sort_order", sa.Integer()),
        sa.column("active", sa.Boolean()),
    )
    existing_slugs = {row[0] for row in bind.execute(sa.text("SELECT slug FROM plans"))}
    plan_rows = []
    for slug, name, tagline, price_cents, members, orders, integrations, storage, sort_order in SEED_PLANS:
        if slug in existing_slugs:
            continue
        plan_rows.append(
            {
                "id": uuid.uuid4(),
                "slug": slug,
                "name": name,
                "tagline": tagline,
                "price_cents": price_cents,
                "currency": "BRL",
                "max_members": members,
                "max_orders_per_month": orders,
                "max_integrations": integrations,
                "max_storage_gb": storage,
                "is_public": True,
                "sort_order": sort_order,
                "active": True,
            }
        )
    if plan_rows:
        op.bulk_insert(plans_seed_table, plan_rows)


def downgrade() -> None:
    # Remove permission grants + codes first (leave every other perm intact).
    placeholders = ", ".join(f"'{c}'" for c in _ALL_NEW_CODES)
    op.execute(
        f"DELETE FROM role_permissions WHERE permission_id IN "
        f"(SELECT id FROM permissions WHERE code IN ({placeholders}))"
    )
    op.execute(f"DELETE FROM permissions WHERE code IN ({placeholders})")

    # Drop tables (subscriptions first — FK to plans), then the enum type.
    op.drop_index(op.f("ix_subscriptions_plan_id"), table_name="subscriptions")
    op.drop_index(op.f("ix_subscriptions_company_id"), table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_index(op.f("ix_plans_slug"), table_name="plans")
    op.drop_table("plans")
    SUBSCRIPTION_STATUS.drop(op.get_bind(), checkfirst=True)
