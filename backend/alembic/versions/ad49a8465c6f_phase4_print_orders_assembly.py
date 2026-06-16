"""phase4 print orders assembly

Phase 4 of the WIP-inventory rework — wiring transitions T4 (print orders) and
T5 (assembly / montagem):

* ``print_orders`` + ``print_order_outputs`` — a per-design print job (mirrors
  ``cutting_orders``) with a status machine and per-(side, variation) planned vs
  printed counts. Completing the order ("Lançar impressos") debits paper and
  credits printed transfers.
* ``assembly_runs`` — provenance row for an assembly run that turns a blank
  piece + a printed transfer into a finished product variation (T5).
* Provenance FK columns on the four existing movement/entry tables, now that the
  ``print_orders`` / ``assembly_runs`` targets exist (all nullable, indexed,
  ``ondelete=SET NULL``):
  - ``paper_roll_movements.print_order_id`` (T4 paper debit)
  - ``printed_transfer_movements.print_order_id`` (T4 credit) +
    ``assembly_run_id`` (T5 debit)
  - ``blank_piece_movements.assembly_run_id`` (T5 debit)
  - ``stock_entries.assembly_run_id`` (T5 finished credit)

The ``print_order_status`` enum was declared in Python in Phase 1 but never
instantiated as a PG type (no earlier column used it); it is created here once
up-front via ``.create(checkfirst=True)`` with the table column referencing a
non-creating handle so ``CREATE TYPE`` is emitted exactly once, and dropped in
downgrade (autogenerate omits DROP TYPE — see ``dca78c0ae4b1``). ``print_side``
already exists (Phase 2, used by ``printed_transfers.side``) — reused as-is via a
non-creating handle, never created/dropped here.

Revision ID: ad49a8465c6f
Revises: bd2969953622
Create Date: 2026-06-15 12:25:13.011831

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ad49a8465c6f"
down_revision: str | Sequence[str] | None = "bd2969953622"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# ``print_order_status`` is introduced by this migration (created up-front,
# dropped on downgrade). ``print_side`` already exists (Phase 2). Both table
# columns reference non-creating handles so the inline ENUM never emits its own
# CREATE TYPE.
print_order_status = postgresql.ENUM("pending", "printing", "done", name="print_order_status", create_type=False)
print_side = postgresql.ENUM("front", "back", name="print_side", create_type=False)


def upgrade() -> None:
    # --- Create the new print_order_status enum once (column uses create_type=False) ---
    print_order_status.create(op.get_bind(), checkfirst=True)

    # --- T4: print orders + per-(side, variation) outputs ---
    op.create_table(
        "print_orders",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("print_design_id", sa.Uuid(), nullable=False),
        sa.Column("paper_roll_id", sa.Uuid(), nullable=True),
        sa.Column("status", print_order_status, nullable=False),
        sa.Column("printed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("meters_consumed", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name=op.f("fk_print_orders_company_id_companies")),
        sa.ForeignKeyConstraint(
            ["paper_roll_id"],
            ["paper_rolls.id"],
            name=op.f("fk_print_orders_paper_roll_id_paper_rolls"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["print_design_id"],
            ["print_designs.id"],
            name=op.f("fk_print_orders_print_design_id_print_designs"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_print_orders")),
    )
    op.create_index(op.f("ix_print_orders_company_id"), "print_orders", ["company_id"], unique=False)
    op.create_index(op.f("ix_print_orders_paper_roll_id"), "print_orders", ["paper_roll_id"], unique=False)
    op.create_index(op.f("ix_print_orders_print_design_id"), "print_orders", ["print_design_id"], unique=False)

    op.create_table(
        "print_order_outputs",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("print_order_id", sa.Uuid(), nullable=False),
        sa.Column("print_design_variation_id", sa.Uuid(), nullable=False),
        sa.Column("side", print_side, nullable=False),
        sa.Column("planned_quantity", sa.Integer(), nullable=False),
        sa.Column("printed_quantity", sa.Integer(), nullable=False),
        sa.CheckConstraint("planned_quantity >= 0", name=op.f("ck_print_order_outputs_planned_quantity_non_negative")),
        sa.CheckConstraint(
            "printed_quantity <= planned_quantity", name=op.f("ck_print_order_outputs_printed_within_planned")
        ),
        sa.CheckConstraint("printed_quantity >= 0", name=op.f("ck_print_order_outputs_printed_quantity_non_negative")),
        sa.ForeignKeyConstraint(
            ["print_design_variation_id"],
            ["print_design_variations.id"],
            name=op.f("fk_print_order_outputs_print_design_variation_id_print_design_variations"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["print_order_id"],
            ["print_orders.id"],
            name=op.f("fk_print_order_outputs_print_order_id_print_orders"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_print_order_outputs")),
        sa.UniqueConstraint(
            "print_order_id",
            "print_design_variation_id",
            "side",
            name="uq_print_order_outputs_order_variation_side",
        ),
    )
    op.create_index(
        op.f("ix_print_order_outputs_print_design_variation_id"),
        "print_order_outputs",
        ["print_design_variation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_print_order_outputs_print_order_id"), "print_order_outputs", ["print_order_id"], unique=False
    )

    # --- T5: assembly runs ---
    op.create_table(
        "assembly_runs",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("blank_piece_id", sa.Uuid(), nullable=False),
        sa.Column("printed_transfer_id", sa.Uuid(), nullable=False),
        sa.Column("variation_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("batch_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_assembly_runs_quantity_positive")),
        sa.ForeignKeyConstraint(
            ["batch_id"], ["batches.id"], name=op.f("fk_assembly_runs_batch_id_batches"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["blank_piece_id"],
            ["blank_pieces.id"],
            name=op.f("fk_assembly_runs_blank_piece_id_blank_pieces"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name=op.f("fk_assembly_runs_company_id_companies")),
        sa.ForeignKeyConstraint(
            ["printed_transfer_id"],
            ["printed_transfers.id"],
            name=op.f("fk_assembly_runs_printed_transfer_id_printed_transfers"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["variation_id"],
            ["product_variations.id"],
            name=op.f("fk_assembly_runs_variation_id_product_variations"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_assembly_runs")),
    )
    op.create_index(op.f("ix_assembly_runs_batch_id"), "assembly_runs", ["batch_id"], unique=False)
    op.create_index(op.f("ix_assembly_runs_blank_piece_id"), "assembly_runs", ["blank_piece_id"], unique=False)
    op.create_index(op.f("ix_assembly_runs_company_id"), "assembly_runs", ["company_id"], unique=False)
    op.create_index(
        op.f("ix_assembly_runs_printed_transfer_id"), "assembly_runs", ["printed_transfer_id"], unique=False
    )
    op.create_index(op.f("ix_assembly_runs_variation_id"), "assembly_runs", ["variation_id"], unique=False)

    # --- Provenance FK columns on the existing movement/entry tables ---
    # (targets print_orders / assembly_runs exist now — order matters.)
    op.add_column("blank_piece_movements", sa.Column("assembly_run_id", sa.Uuid(), nullable=True))
    op.create_index(
        op.f("ix_blank_piece_movements_assembly_run_id"), "blank_piece_movements", ["assembly_run_id"], unique=False
    )
    op.create_foreign_key(
        op.f("fk_blank_piece_movements_assembly_run_id_assembly_runs"),
        "blank_piece_movements",
        "assembly_runs",
        ["assembly_run_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("paper_roll_movements", sa.Column("print_order_id", sa.Uuid(), nullable=True))
    op.create_index(
        op.f("ix_paper_roll_movements_print_order_id"), "paper_roll_movements", ["print_order_id"], unique=False
    )
    op.create_foreign_key(
        op.f("fk_paper_roll_movements_print_order_id_print_orders"),
        "paper_roll_movements",
        "print_orders",
        ["print_order_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("printed_transfer_movements", sa.Column("print_order_id", sa.Uuid(), nullable=True))
    op.add_column("printed_transfer_movements", sa.Column("assembly_run_id", sa.Uuid(), nullable=True))
    op.create_index(
        op.f("ix_printed_transfer_movements_assembly_run_id"),
        "printed_transfer_movements",
        ["assembly_run_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_printed_transfer_movements_print_order_id"),
        "printed_transfer_movements",
        ["print_order_id"],
        unique=False,
    )
    op.create_foreign_key(
        op.f("fk_printed_transfer_movements_assembly_run_id_assembly_runs"),
        "printed_transfer_movements",
        "assembly_runs",
        ["assembly_run_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        op.f("fk_printed_transfer_movements_print_order_id_print_orders"),
        "printed_transfer_movements",
        "print_orders",
        ["print_order_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("stock_entries", sa.Column("assembly_run_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_stock_entries_assembly_run_id"), "stock_entries", ["assembly_run_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_stock_entries_assembly_run_id_assembly_runs"),
        "stock_entries",
        "assembly_runs",
        ["assembly_run_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # --- Drop the provenance FK columns first (they reference the new tables) ---
    op.drop_constraint(op.f("fk_stock_entries_assembly_run_id_assembly_runs"), "stock_entries", type_="foreignkey")
    op.drop_index(op.f("ix_stock_entries_assembly_run_id"), table_name="stock_entries")
    op.drop_column("stock_entries", "assembly_run_id")

    op.drop_constraint(
        op.f("fk_printed_transfer_movements_print_order_id_print_orders"),
        "printed_transfer_movements",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_printed_transfer_movements_assembly_run_id_assembly_runs"),
        "printed_transfer_movements",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_printed_transfer_movements_print_order_id"), table_name="printed_transfer_movements")
    op.drop_index(op.f("ix_printed_transfer_movements_assembly_run_id"), table_name="printed_transfer_movements")
    op.drop_column("printed_transfer_movements", "assembly_run_id")
    op.drop_column("printed_transfer_movements", "print_order_id")

    op.drop_constraint(
        op.f("fk_paper_roll_movements_print_order_id_print_orders"), "paper_roll_movements", type_="foreignkey"
    )
    op.drop_index(op.f("ix_paper_roll_movements_print_order_id"), table_name="paper_roll_movements")
    op.drop_column("paper_roll_movements", "print_order_id")

    op.drop_constraint(
        op.f("fk_blank_piece_movements_assembly_run_id_assembly_runs"), "blank_piece_movements", type_="foreignkey"
    )
    op.drop_index(op.f("ix_blank_piece_movements_assembly_run_id"), table_name="blank_piece_movements")
    op.drop_column("blank_piece_movements", "assembly_run_id")

    # --- Drop the new tables (print_side is left in place — owned by Phase 2) ---
    op.drop_index(op.f("ix_assembly_runs_variation_id"), table_name="assembly_runs")
    op.drop_index(op.f("ix_assembly_runs_printed_transfer_id"), table_name="assembly_runs")
    op.drop_index(op.f("ix_assembly_runs_company_id"), table_name="assembly_runs")
    op.drop_index(op.f("ix_assembly_runs_blank_piece_id"), table_name="assembly_runs")
    op.drop_index(op.f("ix_assembly_runs_batch_id"), table_name="assembly_runs")
    op.drop_table("assembly_runs")

    op.drop_index(op.f("ix_print_order_outputs_print_order_id"), table_name="print_order_outputs")
    op.drop_index(op.f("ix_print_order_outputs_print_design_variation_id"), table_name="print_order_outputs")
    op.drop_table("print_order_outputs")

    op.drop_index(op.f("ix_print_orders_print_design_id"), table_name="print_orders")
    op.drop_index(op.f("ix_print_orders_paper_roll_id"), table_name="print_orders")
    op.drop_index(op.f("ix_print_orders_company_id"), table_name="print_orders")
    op.drop_table("print_orders")

    # autogenerate never emits DROP TYPE — do it explicitly now the table is gone.
    print_order_status.drop(op.get_bind(), checkfirst=True)
