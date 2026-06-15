"""phase1 foundations

Phase 1 of the WIP-inventory rework. This single migration covers:

* Enum value-set changes:
  - ``product_type`` redefined to garment types (drop + recreate, remap old rows).
  - ``batch_status`` redefined (``adjusted``→``open``, ``printed``→``in_production``).
  - ``size`` gains ``u`` (Único); ``stock_source`` gains ``assembly`` (additive).
* New tables: ``company_settings`` (catalog config JSONB) and
  ``print_design_variations`` (per-side artwork + ``artwork_status``).
* ``print_designs`` gains ``has_front`` / ``has_back`` flags.
* Retire Montador: drop ``batch_print_adjustments``, ``batches.prints_sent_at``,
  ``companies.montador_user_email``.
* Seed the 12 new permission codes (read+write for paper, blank_stock,
  printed_stock, print_orders, assembly, planning) and grant them to the global
  admin / manager / operator roles.

Revision ID: 5cb243095dc7
Revises: 6d396bf4bc50
Create Date: 2026-06-14 22:37:07.513185

"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5cb243095dc7"
down_revision: str | Sequence[str] | None = "6d396bf4bc50"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# ---------------------------------------------------------------------------
# Enum value-sets (canonical, for drop/recreate of the redefined types)
# ---------------------------------------------------------------------------
PRODUCT_TYPE_NEW = ("camiseta", "moletom", "regata", "blusa", "calca", "bermuda", "ecobag", "cropped")
PRODUCT_TYPE_OLD = ("tshirt", "sweatshirt", "shorts", "tanktop")
BATCH_STATUS_NEW = ("open", "in_production", "dispatched", "done", "cancelled")
BATCH_STATUS_OLD = ("open", "adjusted", "printed", "done", "cancelled")

# Best-effort remap of any existing rows (no backward-compat guarantee — the old
# and new garment sets do not overlap, so these are arbitrary-but-total casts).
_PRODUCT_TYPE_UP = {"tshirt": "camiseta", "sweatshirt": "moletom", "shorts": "bermuda", "tanktop": "regata"}
_PRODUCT_TYPE_DOWN = {"camiseta": "tshirt", "moletom": "sweatshirt", "bermuda": "shorts", "regata": "tanktop"}
_BATCH_STATUS_UP = {"adjusted": "open", "printed": "in_production"}
_BATCH_STATUS_DOWN = {"in_production": "printed", "dispatched": "printed"}

# The artwork_status PG ENUM is created implicitly by the print_design_variations
# columns below. Build a non-creating handle so downgrade can DROP TYPE — and
# create it once up-front so the two columns don't each emit CREATE TYPE.
artwork_status = postgresql.ENUM("ok", "pending", name="artwork_status", create_type=False)

# New permission codes + the roles that receive them.
_NEW_PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("paper.read", "Read: Paper/film rolls (bobinas de papel)"),
    ("paper.write", "Write: Paper/film rolls (bobinas de papel)"),
    ("blank_stock.read", "Read: Blank pieces (peças lisas)"),
    ("blank_stock.write", "Write: Blank pieces (peças lisas)"),
    ("printed_stock.read", "Read: Printed transfers (estampados)"),
    ("printed_stock.write", "Write: Printed transfers (estampados)"),
    ("print_orders.read", "Read: Print orders (ordens de impressão)"),
    ("print_orders.write", "Write: Print orders (ordens de impressão)"),
    ("assembly.read", "Read: Assembly (montagem)"),
    ("assembly.write", "Write: Assembly (montagem)"),
    ("planning.read", "Read: Production planning (planejamento)"),
    ("planning.write", "Write: Production planning (planejamento)"),
)
_ALL_CODES = tuple(code for code, _ in _NEW_PERMISSIONS)
# operator gets write on the 5 production/inventory domains + planning READ only.
_OPERATOR_CODES = (
    "paper.read",
    "paper.write",
    "blank_stock.read",
    "blank_stock.write",
    "printed_stock.read",
    "printed_stock.write",
    "print_orders.read",
    "print_orders.write",
    "assembly.read",
    "assembly.write",
    "planning.read",
)
_GRANTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("admin", _ALL_CODES),
    ("manager", _ALL_CODES),
    ("operator", _OPERATOR_CODES),
)


def _swap_enum(
    *,
    type_name: str,
    new_values: Sequence[str],
    columns: Sequence[tuple[str, str]],
    remap: dict[str, str],
) -> None:
    """Drop + recreate an enum type with a new value-set, re-pointing its columns.

    Renames the live type aside, creates the new type, re-points every dependent
    ``(table, column)`` with a CASE-based ``USING`` cast (remapping any retired
    values), then drops the old type. ALL columns using the type must be listed
    or the final ``DROP TYPE`` fails on a lingering dependency. Fully
    transactional and reversible.
    """
    old_alias = f"{type_name}__old"
    op.execute(f"ALTER TYPE {type_name} RENAME TO {old_alias}")
    values_sql = ", ".join(f"'{v}'" for v in new_values)
    op.execute(f"CREATE TYPE {type_name} AS ENUM ({values_sql})")
    whens = " ".join(f"WHEN '{old}' THEN '{new}'" for old, new in remap.items())
    for table, column in columns:
        case_expr = f"CASE {column}::text {whens} ELSE {column}::text END" if whens else f"{column}::text"
        op.execute(f"ALTER TABLE {table} ALTER COLUMN {column} TYPE {type_name} USING ({case_expr})::{type_name}")
    op.execute(f"DROP TYPE {old_alias}")


def upgrade() -> None:
    # --- Additive enum values (size, stock_source). Safe in-tx on PG 12+ as long
    #     as the new label is not used in this same transaction (it is not). ---
    op.execute("ALTER TYPE size ADD VALUE IF NOT EXISTS 'u'")
    op.execute("ALTER TYPE stock_source ADD VALUE IF NOT EXISTS 'assembly'")

    # --- Redefined enums (product_type, batch_status) — drop/recreate + remap ---
    _swap_enum(
        type_name="product_type",
        new_values=PRODUCT_TYPE_NEW,
        columns=(("products", "product_type"),),
        remap=_PRODUCT_TYPE_UP,
    )
    _swap_enum(
        type_name="batch_status",
        new_values=BATCH_STATUS_NEW,
        columns=(("batches", "status"),),
        remap=_BATCH_STATUS_UP,
    )

    # --- New artwork_status enum type (used by print_design_variations) ---
    artwork_status.create(op.get_bind(), checkfirst=True)

    # --- New tables ---
    op.create_table(
        "company_settings",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column(
            "config",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_company_settings_company_id_companies")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_company_settings")),
        sa.UniqueConstraint("company_id", name="uq_company_settings_company_id"),
    )
    op.create_index(op.f("ix_company_settings_company_id"), "company_settings", ["company_id"], unique=False)

    op.create_table(
        "print_design_variations",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("print_design_id", sa.Uuid(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=80), nullable=False),
        sa.Column("ink_hex", sqlmodel.sql.sqltypes.AutoString(length=7), nullable=False),
        sa.Column("front_file_url", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("front_status", artwork_status, nullable=False),
        sa.Column("back_file_url", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("back_status", artwork_status, nullable=False),
        sa.CheckConstraint("ink_hex ~ '^#[0-9A-Fa-f]{6}$'", name=op.f("ck_print_design_variations_ink_hex_format")),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name=op.f("fk_print_design_variations_company_id_companies"),
        ),
        sa.ForeignKeyConstraint(
            ["print_design_id"],
            ["print_designs.id"],
            name=op.f("fk_print_design_variations_print_design_id_print_designs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_print_design_variations")),
    )
    op.create_index(
        op.f("ix_print_design_variations_company_id"), "print_design_variations", ["company_id"], unique=False
    )
    op.create_index(
        op.f("ix_print_design_variations_print_design_id"),
        "print_design_variations",
        ["print_design_id"],
        unique=False,
    )

    # --- PrintDesign side flags (server_default so existing rows backfill) ---
    op.add_column(
        "print_designs",
        sa.Column("has_front", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "print_designs",
        sa.Column("has_back", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # --- Retire Montador: drop adjustments table + montador columns ---
    op.drop_index(op.f("ix_batch_print_adjustments_batch_id"), table_name="batch_print_adjustments")
    op.drop_index(op.f("ix_batch_print_adjustments_company_id"), table_name="batch_print_adjustments")
    op.drop_index(op.f("ix_batch_print_adjustments_print_design_id"), table_name="batch_print_adjustments")
    op.drop_table("batch_print_adjustments")
    op.drop_column("batches", "prints_sent_at")
    op.drop_column("companies", "montador_user_email")

    # --- Seed new permissions + grants ---
    _seed_permissions()


def _seed_permissions() -> None:
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
    bind = op.get_bind()

    # Insert codes idempotently (reuse any already present).
    placeholders = ", ".join(f"'{c}'" for c in _ALL_CODES)
    existing = {row[0] for row in bind.execute(sa.text(f"SELECT code FROM permissions WHERE code IN ({placeholders})"))}
    permission_ids: dict[str, uuid.UUID] = {}
    new_rows = []
    for code, description in _NEW_PERMISSIONS:
        if code in existing:
            permission_ids[code] = bind.execute(
                sa.text("SELECT id FROM permissions WHERE code = :code"), {"code": code}
            ).scalar()
            continue
        pid = uuid.uuid4()
        permission_ids[code] = pid
        new_rows.append({"id": pid, "code": code, "description": description})
    if new_rows:
        op.bulk_insert(permissions_table, new_rows)

    # Grant to the global roles (company_id IS NULL), skipping existing grants.
    grant_rows = []
    for role_code, codes in _GRANTS:
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
    # --- Remove seeded grants + permission codes ---
    placeholders = ", ".join(f"'{c}'" for c in _ALL_CODES)
    op.execute(
        f"DELETE FROM role_permissions WHERE permission_id IN "
        f"(SELECT id FROM permissions WHERE code IN ({placeholders}))"
    )
    op.execute(f"DELETE FROM permissions WHERE code IN ({placeholders})")

    # --- Restore Montador columns + adjustments table ---
    op.add_column(
        "companies", sa.Column("montador_user_email", sa.VARCHAR(length=255), autoincrement=False, nullable=True)
    )
    op.add_column(
        "batches",
        sa.Column("prints_sent_at", postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
    )
    op.create_table(
        "batch_print_adjustments",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), autoincrement=False, nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("company_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("batch_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("print_design_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("product_color", sa.VARCHAR(length=80), autoincrement=False, nullable=False),
        sa.Column("qty_needed", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("qty_stock", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("qty_to_print", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("prints_sent", sa.BOOLEAN(), autoincrement=False, nullable=False),
        sa.Column("stock_committed_at", postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
        sa.CheckConstraint("qty_needed >= 0", name=op.f("ck_batch_print_adjustments_qty_needed_non_negative")),
        sa.CheckConstraint("qty_stock >= 0", name=op.f("ck_batch_print_adjustments_qty_stock_non_negative")),
        sa.CheckConstraint("qty_to_print >= 0", name=op.f("ck_batch_print_adjustments_qty_to_print_non_negative")),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["batches.id"],
            name=op.f("fk_batch_print_adjustments_batch_id_batches"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_batch_print_adjustments_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["print_design_id"],
            ["print_designs.id"],
            name=op.f("fk_batch_print_adjustments_print_design_id_print_designs"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_batch_print_adjustments")),
        sa.UniqueConstraint(
            "batch_id",
            "print_design_id",
            "product_color",
            name=op.f("uq_batch_print_adjustments_design_color"),
        ),
    )
    op.create_index(
        op.f("ix_batch_print_adjustments_print_design_id"), "batch_print_adjustments", ["print_design_id"], unique=False
    )
    op.create_index(
        op.f("ix_batch_print_adjustments_company_id"), "batch_print_adjustments", ["company_id"], unique=False
    )
    op.create_index(op.f("ix_batch_print_adjustments_batch_id"), "batch_print_adjustments", ["batch_id"], unique=False)

    # --- Drop PrintDesign side flags ---
    op.drop_column("print_designs", "has_back")
    op.drop_column("print_designs", "has_front")

    # --- Drop new tables + artwork_status type ---
    op.drop_index(op.f("ix_print_design_variations_print_design_id"), table_name="print_design_variations")
    op.drop_index(op.f("ix_print_design_variations_company_id"), table_name="print_design_variations")
    op.drop_table("print_design_variations")
    op.drop_index(op.f("ix_company_settings_company_id"), table_name="company_settings")
    op.drop_table("company_settings")
    artwork_status.drop(op.get_bind(), checkfirst=True)

    # --- Revert redefined enums (recreate old value-sets + remap) ---
    _swap_enum(
        type_name="batch_status",
        new_values=BATCH_STATUS_OLD,
        columns=(("batches", "status"),),
        remap=_BATCH_STATUS_DOWN,
    )
    _swap_enum(
        type_name="product_type",
        new_values=PRODUCT_TYPE_OLD,
        columns=(("products", "product_type"),),
        remap=_PRODUCT_TYPE_DOWN,
    )

    # --- Revert additive enums (size, stock_source): recreate without new label.
    #     ``size`` is used by three columns — all must be re-pointed before the
    #     old type can be dropped. ---
    _swap_enum(
        type_name="size",
        new_values=("p", "m", "g", "gg"),
        columns=(
            ("cutting_order_outputs", "size"),
            ("product_variations", "size"),
            ("sewing_shipment_items", "size"),
        ),
        remap={"u": "p"},
    )
    _swap_enum(
        type_name="stock_source",
        new_values=("shipment", "adjustment", "return"),
        columns=(("stock_entries", "source"),),
        remap={"assembly": "adjustment"},
    )
