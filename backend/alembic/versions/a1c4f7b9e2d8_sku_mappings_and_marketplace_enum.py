"""add sku_mappings De/Para + convert imported_orders.marketplace to enum

Three changes, in one migration:

1. Extends the ``ecommerce`` enum with ``shein`` and ``tiktok_shop`` (the two
   real marketplaces in the Upseller export not yet covered). Done inside an
   ``autocommit_block`` because Postgres forbids *using* a freshly-added enum
   value (the column cast in step 3) in the same transaction it was added.

2. Creates ``sku_mappings`` — the persistent De/Para keyed on the marketplace
   SKU: ``(company, marketplace, sku) → (ad_id, variation_id)``. Reuses the
   existing ``ecommerce`` enum WITHOUT re-creating the type.

3. Converts ``imported_orders.marketplace`` from free-text ``varchar(60)`` to
   the ``ecommerce`` enum: drop the unique key, normalize the raw labels to
   enum members, drop the rows that now collide (same physical line imported
   under two spellings, e.g. base44 "Mercado Livre" + upseller "Mercado
   Libre"), cast the column, then rebuild the unique key.

Revision ID: a1c4f7b9e2d8
Revises: b7d2c9a4e1f3
Create Date: 2026-06-29 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1c4f7b9e2d8"
down_revision: str | Sequence[str] | None = "b7d2c9a4e1f3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Existing enum — referenced WITHOUT creating the type (already in the DB).
ECOMMERCE = postgresql.ENUM(
    "shopee",
    "mercado_livre",
    "shein",
    "tiktok_shop",
    "shopify",
    "instagram",
    "whatsapp",
    "other",
    name="ecommerce",
    create_type=False,
)

_MKT_UQ = "uq_imported_orders_marketplace_platform_order_id_sku"

# Raw export label (lowercased) → enum member. Order matters: first hit wins.
_NORMALIZE_SQL = """
    UPDATE imported_orders SET marketplace = CASE
        WHEN lower(marketplace) LIKE '%shopee%'    THEN 'shopee'
        WHEN lower(marketplace) LIKE '%mercado%'   THEN 'mercado_livre'
        WHEN lower(marketplace) LIKE '%shein%'     THEN 'shein'
        WHEN lower(marketplace) LIKE '%tiktok%'    THEN 'tiktok_shop'
        WHEN lower(marketplace) LIKE '%tik tok%'   THEN 'tiktok_shop'
        WHEN lower(marketplace) LIKE '%shopify%'   THEN 'shopify'
        WHEN lower(marketplace) LIKE '%instagram%' THEN 'instagram'
        WHEN lower(marketplace) LIKE '%whats%'     THEN 'whatsapp'
        ELSE 'other'
    END
"""

# After normalization, collapse rows that now violate the unique key, keeping
# one physical row per (company, marketplace, platform_order_id, sku).
_DEDUP_SQL = """
    DELETE FROM imported_orders a
    USING imported_orders b
    WHERE a.company_id = b.company_id
      AND a.marketplace = b.marketplace
      AND a.platform_order_id = b.platform_order_id
      AND a.sku = b.sku
      AND a.ctid > b.ctid
"""


def upgrade() -> None:
    # --- 1. extend the enum (committed before the cast in step 3 uses it) ---
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE ecommerce ADD VALUE IF NOT EXISTS 'shein'")
        op.execute("ALTER TYPE ecommerce ADD VALUE IF NOT EXISTS 'tiktok_shop'")

    # --- 2. sku_mappings table ---
    op.create_table(
        "sku_mappings",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("marketplace", ECOMMERCE, nullable=False),
        sa.Column("sku", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=False),
        sa.Column("ad_id", sa.Uuid(), nullable=False),
        sa.Column("variation_id", sa.Uuid(), nullable=False),
        sa.Column("source", sqlmodel.sql.sqltypes.AutoString(length=40), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name=op.f("fk_sku_mappings_company_id_companies")),
        sa.ForeignKeyConstraint(["ad_id"], ["ads.id"], name=op.f("fk_sku_mappings_ad_id_ads"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["variation_id"],
            ["product_variations.id"],
            name=op.f("fk_sku_mappings_variation_id_product_variations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name=op.f("fk_sku_mappings_created_by_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sku_mappings")),
        sa.UniqueConstraint("company_id", "marketplace", "sku", name="uq_sku_mappings_company_id_marketplace_sku"),
    )
    op.create_index(op.f("ix_sku_mappings_company_id"), "sku_mappings", ["company_id"], unique=False)
    op.create_index(op.f("ix_sku_mappings_ad_id"), "sku_mappings", ["ad_id"], unique=False)
    op.create_index(op.f("ix_sku_mappings_variation_id"), "sku_mappings", ["variation_id"], unique=False)

    # --- 3. convert imported_orders.marketplace varchar -> ecommerce enum ---
    op.drop_constraint(_MKT_UQ, "imported_orders", type_="unique")
    op.execute(_NORMALIZE_SQL)
    op.execute(_DEDUP_SQL)
    op.execute("ALTER TABLE imported_orders ALTER COLUMN marketplace TYPE ecommerce USING marketplace::ecommerce")
    op.create_unique_constraint(_MKT_UQ, "imported_orders", ["company_id", "marketplace", "platform_order_id", "sku"])


def downgrade() -> None:
    # Revert the column to free text (the added enum values stay — Postgres has
    # no DROP VALUE; they are harmless if unused).
    op.drop_constraint(_MKT_UQ, "imported_orders", type_="unique")
    op.execute("ALTER TABLE imported_orders ALTER COLUMN marketplace TYPE VARCHAR(60) USING marketplace::text")
    op.create_unique_constraint(_MKT_UQ, "imported_orders", ["company_id", "marketplace", "platform_order_id", "sku"])

    op.drop_index(op.f("ix_sku_mappings_variation_id"), table_name="sku_mappings")
    op.drop_index(op.f("ix_sku_mappings_ad_id"), table_name="sku_mappings")
    op.drop_index(op.f("ix_sku_mappings_company_id"), table_name="sku_mappings")
    op.drop_table("sku_mappings")
