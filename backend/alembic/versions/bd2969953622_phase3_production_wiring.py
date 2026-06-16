"""phase3 production wiring

Phase 3 of the WIP-inventory rework — wiring transitions T1/T2/T3:

* ``fabric_roll_movements`` — append-only ledger for fabric rolls (history
  only; ``current_weight_kg`` stays authoritative), with ``cutting_order_id``
  provenance for the T1 fabric debit on cutting DONE. New
  ``fabric_movement_kind`` PG enum.
* ``cutting_orders`` becomes print-agnostic: drop ``product_id`` (FK + index +
  column); add ``spec_id`` (FK product_specs RESTRICT, indexed), ``color``,
  ``color_code`` (3-letter, ``^[A-Z]{3}$`` check). No data backfill — dev DB.
* ``sewing_shipment_items.credited_quantity`` (T3 delta-credit watermark) +
  its two checks (``credited_non_negative``, ``credited_within_received``).
* ``stock_entries`` drops ``shipment_id`` (FK + index + column) — sewing no
  longer credits finished stock (it credits blank pieces in T3).

The ``fabric_movement_kind`` enum was declared in Python in Phase 3 but never
instantiated as a PG type (Phase 2 created the other movement-kind enums). It
is created here once up-front via ``.create(checkfirst=True)`` with the table
column referencing a non-creating handle so ``CREATE TYPE`` is emitted exactly
once; downgrade drops it (autogenerate omits DROP TYPE — see ``dca78c0ae4b1``).

Revision ID: bd2969953622
Revises: dca78c0ae4b1
Create Date: 2026-06-15 09:06:52.918008

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bd2969953622"
down_revision: str | Sequence[str] | None = "dca78c0ae4b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# The fabric_roll_movements table column references this non-creating handle
# (``create_type=False``); the type is instead created once explicitly at the
# top of upgrade() and dropped in downgrade().
fabric_movement_kind = postgresql.ENUM("entry", "exit", "adjustment", name="fabric_movement_kind", create_type=False)


def upgrade() -> None:
    # --- Create the new fabric_movement_kind enum once (column uses create_type=False) ---
    fabric_movement_kind.create(op.get_bind(), checkfirst=True)

    # --- New fabric movement ledger (mirrors paper_roll_movements) ---
    op.create_table(
        "fabric_roll_movements",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("fabric_roll_id", sa.Uuid(), nullable=False),
        sa.Column("kind", fabric_movement_kind, nullable=False),
        sa.Column("quantity", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("cutting_order_id", sa.Uuid(), nullable=True),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_fabric_roll_movements_quantity_positive")),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_fabric_roll_movements_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["cutting_order_id"],
            ["cutting_orders.id"],
            name=op.f("fk_fabric_roll_movements_cutting_order_id_cutting_orders"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["fabric_roll_id"],
            ["fabric_rolls.id"],
            name=op.f("fk_fabric_roll_movements_fabric_roll_id_fabric_rolls"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fabric_roll_movements")),
    )
    op.create_index(op.f("ix_fabric_roll_movements_company_id"), "fabric_roll_movements", ["company_id"], unique=False)
    op.create_index(
        op.f("ix_fabric_roll_movements_cutting_order_id"),
        "fabric_roll_movements",
        ["cutting_order_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fabric_roll_movements_fabric_roll_id"), "fabric_roll_movements", ["fabric_roll_id"], unique=False
    )

    # --- cutting_orders: drop product_id (FK + index + column); add spec-key ---
    # Backfill so this is safe on a populated DB (prod may hold pre-rework cutting
    # orders): spec_id is taken from the old product's spec; color/color_code get
    # a legacy placeholder (pre-rework cutting orders had no colour dimension).
    # Add nullable → backfill → enforce NOT NULL.
    op.add_column("cutting_orders", sa.Column("spec_id", sa.Uuid(), nullable=True))
    op.add_column("cutting_orders", sa.Column("color", sqlmodel.sql.sqltypes.AutoString(length=40), nullable=True))
    op.add_column("cutting_orders", sa.Column("color_code", sqlmodel.sql.sqltypes.AutoString(length=3), nullable=True))
    op.execute(
        "UPDATE cutting_orders co SET spec_id = p.spec_id "
        "FROM products p WHERE p.id = co.product_id AND co.spec_id IS NULL"
    )
    op.execute("UPDATE cutting_orders SET color = 'Legado' WHERE color IS NULL")
    op.execute("UPDATE cutting_orders SET color_code = 'LEG' WHERE color_code IS NULL")
    # Fail loudly rather than silently dropping rows: if any cutting order could
    # not resolve a spec (orphaned product_id, or an unexpected NULL products.spec_id
    # — neither should occur under the old NOT NULL FK), abort so it can be
    # investigated. The single-transaction upgrade rolls back cleanly on raise, so
    # no rows are modified.
    unresolved = (
        op.get_bind().execute(sa.text("SELECT count(*) FROM cutting_orders WHERE spec_id IS NULL")).scalar() or 0
    )
    if unresolved:
        raise RuntimeError(
            f"{unresolved} cutting_orders row(s) could not resolve spec_id from product_id; "
            "investigate before enforcing NOT NULL (no rows were modified)."
        )
    op.alter_column("cutting_orders", "spec_id", nullable=False)
    op.alter_column("cutting_orders", "color", nullable=False)
    op.alter_column("cutting_orders", "color_code", nullable=False)
    op.create_check_constraint("cutting_orders_color_code_format", "cutting_orders", r"color_code ~ '^[A-Z]{3}$'")
    op.drop_index(op.f("ix_cutting_orders_product_id"), table_name="cutting_orders")
    op.create_index(op.f("ix_cutting_orders_spec_id"), "cutting_orders", ["spec_id"], unique=False)
    op.drop_constraint(op.f("fk_cutting_orders_product_id_products"), "cutting_orders", type_="foreignkey")
    op.create_foreign_key(
        op.f("fk_cutting_orders_spec_id_product_specs"),
        "cutting_orders",
        "product_specs",
        ["spec_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.drop_column("cutting_orders", "product_id")

    # --- sewing_shipment_items: add credited_quantity (T3 watermark) + checks ---
    op.add_column(
        "sewing_shipment_items",
        sa.Column("credited_quantity", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.create_check_constraint("credited_non_negative", "sewing_shipment_items", "credited_quantity >= 0")
    op.create_check_constraint(
        "credited_within_received", "sewing_shipment_items", "credited_quantity <= received_quantity"
    )

    # --- stock_entries: drop shipment_id (FK + index + column) ---
    op.drop_index(op.f("ix_stock_entries_shipment_id"), table_name="stock_entries")
    op.drop_constraint(op.f("fk_stock_entries_shipment_id_sewing_shipments"), "stock_entries", type_="foreignkey")
    op.drop_column("stock_entries", "shipment_id")


def downgrade() -> None:
    # --- stock_entries: restore shipment_id ---
    op.add_column("stock_entries", sa.Column("shipment_id", sa.UUID(), autoincrement=False, nullable=True))
    op.create_foreign_key(
        op.f("fk_stock_entries_shipment_id_sewing_shipments"),
        "stock_entries",
        "sewing_shipments",
        ["shipment_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_stock_entries_shipment_id"), "stock_entries", ["shipment_id"], unique=False)

    # --- sewing_shipment_items: drop credited_quantity + its checks ---
    op.drop_constraint("credited_within_received", "sewing_shipment_items", type_="check")
    op.drop_constraint("credited_non_negative", "sewing_shipment_items", type_="check")
    op.drop_column("sewing_shipment_items", "credited_quantity")

    # --- cutting_orders: restore product_id; drop spec-key ---
    op.add_column("cutting_orders", sa.Column("product_id", sa.UUID(), autoincrement=False, nullable=False))
    op.drop_constraint(op.f("fk_cutting_orders_spec_id_product_specs"), "cutting_orders", type_="foreignkey")
    op.create_foreign_key(
        op.f("fk_cutting_orders_product_id_products"),
        "cutting_orders",
        "products",
        ["product_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.drop_index(op.f("ix_cutting_orders_spec_id"), table_name="cutting_orders")
    op.create_index(op.f("ix_cutting_orders_product_id"), "cutting_orders", ["product_id"], unique=False)
    op.drop_constraint("cutting_orders_color_code_format", "cutting_orders", type_="check")
    op.drop_column("cutting_orders", "color_code")
    op.drop_column("cutting_orders", "color")
    op.drop_column("cutting_orders", "spec_id")

    # --- Drop fabric movement ledger + its enum ---
    op.drop_index(op.f("ix_fabric_roll_movements_fabric_roll_id"), table_name="fabric_roll_movements")
    op.drop_index(op.f("ix_fabric_roll_movements_cutting_order_id"), table_name="fabric_roll_movements")
    op.drop_index(op.f("ix_fabric_roll_movements_company_id"), table_name="fabric_roll_movements")
    op.drop_table("fabric_roll_movements")
    # autogenerate never emits DROP TYPE — do it explicitly now the table is gone.
    fabric_movement_kind.drop(op.get_bind(), checkfirst=True)
