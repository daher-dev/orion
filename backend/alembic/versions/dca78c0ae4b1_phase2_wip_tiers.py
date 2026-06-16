"""phase2 wip tiers

Phase 2 of the WIP-inventory rework. This single migration covers:

* Three new WIP inventory tiers, each a catalog/balance table + an append-only
  movement ledger:
  - ``blank_pieces`` + ``blank_piece_movements`` (peças lisas — counted)
  - ``paper_rolls`` + ``paper_roll_movements`` (bobinas de papel — metered, with
    an authoritative ``current_meters`` column like ``fabric_rolls``)
  - ``printed_transfers`` + ``printed_transfer_movements`` (estampados — counted)
* Retire the old ``print_stock`` tier (replaced by ``printed_transfers``):
  - drop ``print_stock_movements``
  - drop the ``print_stock_direction`` PG enum type
  - delete the ``print_stock.read`` / ``print_stock.write`` permissions + grants

The five movement-kind / side / paper-type enums (``blank_movement_kind``,
``paper_movement_kind``, ``printed_movement_kind``, ``print_side``,
``paper_type``) were declared in Python in Phase 1 but never instantiated as PG
types (no Phase-1 column used them). They are created here, once up-front via
``.create(checkfirst=True)``, with the table columns referencing non-creating
handles so each ``CREATE TYPE`` is emitted exactly once; downgrade drops them.
The pre-existing ``size`` type is reused as-is (``create_type=False``, never
dropped).

Revision ID: dca78c0ae4b1
Revises: 5cb243095dc7
Create Date: 2026-06-15 07:36:31.312526

"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "dca78c0ae4b1"
down_revision: str | Sequence[str] | None = "5cb243095dc7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# ---------------------------------------------------------------------------
# Enum handles. All table columns reference non-creating handles
# (``create_type=False``) so an inline ENUM never emits its own CREATE TYPE; the
# five new types are instead created once, explicitly, at the top of upgrade()
# (see ``_NEW_ENUMS``) and dropped in downgrade(). ``size`` already exists in the
# DB (Phase 1) — reused as-is, never created/dropped here.
# ---------------------------------------------------------------------------
paper_type = postgresql.ENUM("dtf_film", "sublimation_paper", "transfer_paper", name="paper_type", create_type=False)
size = postgresql.ENUM("p", "m", "g", "gg", "u", name="size", create_type=False)
print_side = postgresql.ENUM("front", "back", name="print_side", create_type=False)
blank_movement_kind = postgresql.ENUM("entry", "exit", "adjustment", name="blank_movement_kind", create_type=False)
paper_movement_kind = postgresql.ENUM("entry", "exit", "adjustment", name="paper_movement_kind", create_type=False)
printed_movement_kind = postgresql.ENUM("entry", "exit", "adjustment", name="printed_movement_kind", create_type=False)

# Types this migration introduces (created up-front, dropped on downgrade).
_NEW_ENUMS = (paper_type, print_side, blank_movement_kind, paper_movement_kind, printed_movement_kind)

# The print_stock_direction type is dropped on upgrade and recreated implicitly
# by the print_stock_movements table on downgrade. Build a non-creating handle
# for the explicit DROP in upgrade() (autogenerate never emits DROP TYPE).
print_stock_direction = postgresql.ENUM("entry", "exit", "adjustment", name="print_stock_direction", create_type=False)

# print_stock permissions retired by this migration (re-seeded on downgrade).
_PRINT_STOCK_PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("print_stock.read", "Read: Print stock (estoque de estampas / impresso)"),
    ("print_stock.write", "Write: Print stock (estoque de estampas / impresso)"),
)
_PRINT_STOCK_CODES = tuple(code for code, _ in _PRINT_STOCK_PERMISSIONS)
# All three operational roles held these grants (see 95e36cb45a49).
_PRINT_STOCK_GRANTS: tuple[str, ...] = ("admin", "manager", "operator")


def upgrade() -> None:
    # --- Create the five new enum types once (columns use create_type=False) ---
    bind = op.get_bind()
    for enum in _NEW_ENUMS:
        enum.create(bind, checkfirst=True)

    # --- New WIP inventory tiers (3 balance tables + 3 ledgers) ---
    op.create_table(
        "paper_rolls",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("received_at", sa.Date(), nullable=False),
        sa.Column("supplier_name", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=False),
        sa.Column("paper_type", paper_type, nullable=False),
        sa.Column("width_cm", sa.Integer(), nullable=False),
        sa.Column("initial_meters", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("current_meters", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("min_stock", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.CheckConstraint("current_meters >= 0", name=op.f("ck_paper_rolls_current_meters_non_negative")),
        sa.CheckConstraint("initial_meters > 0", name=op.f("ck_paper_rolls_initial_meters_positive")),
        sa.CheckConstraint("min_stock IS NULL OR min_stock >= 0", name=op.f("ck_paper_rolls_min_stock_non_negative")),
        sa.CheckConstraint("width_cm > 0", name=op.f("ck_paper_rolls_width_cm_positive")),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name=op.f("fk_paper_rolls_company_id_companies")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_paper_rolls")),
    )
    op.create_index(op.f("ix_paper_rolls_company_id"), "paper_rolls", ["company_id"], unique=False)

    op.create_table(
        "blank_pieces",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("spec_id", sa.Uuid(), nullable=False),
        sa.Column("size", size, nullable=False),
        sa.Column("color", sqlmodel.sql.sqltypes.AutoString(length=40), nullable=False),
        sa.Column("color_code", sqlmodel.sql.sqltypes.AutoString(length=3), nullable=False),
        sa.Column("min_stock", sa.Integer(), nullable=True),
        sa.CheckConstraint("color_code ~ '^[A-Z]{3}$'", name=op.f("ck_blank_pieces_color_code_format")),
        sa.CheckConstraint("min_stock IS NULL OR min_stock >= 0", name=op.f("ck_blank_pieces_min_stock_non_negative")),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], name=op.f("fk_blank_pieces_company_id_companies")),
        sa.ForeignKeyConstraint(
            ["spec_id"],
            ["product_specs.id"],
            name=op.f("fk_blank_pieces_spec_id_product_specs"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_blank_pieces")),
        sa.UniqueConstraint(
            "company_id",
            "spec_id",
            "size",
            "color_code",
            name="uq_blank_pieces_company_id_spec_id_size_color_code",
        ),
    )
    op.create_index(op.f("ix_blank_pieces_company_id"), "blank_pieces", ["company_id"], unique=False)
    op.create_index(op.f("ix_blank_pieces_spec_id"), "blank_pieces", ["spec_id"], unique=False)

    op.create_table(
        "paper_roll_movements",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("paper_roll_id", sa.Uuid(), nullable=False),
        sa.Column("kind", paper_movement_kind, nullable=False),
        sa.Column("quantity", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_paper_roll_movements_quantity_positive")),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_paper_roll_movements_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["paper_roll_id"],
            ["paper_rolls.id"],
            name=op.f("fk_paper_roll_movements_paper_roll_id_paper_rolls"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_paper_roll_movements")),
    )
    op.create_index(op.f("ix_paper_roll_movements_company_id"), "paper_roll_movements", ["company_id"], unique=False)
    op.create_index(
        op.f("ix_paper_roll_movements_paper_roll_id"), "paper_roll_movements", ["paper_roll_id"], unique=False
    )

    op.create_table(
        "printed_transfers",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("print_design_id", sa.Uuid(), nullable=False),
        sa.Column("side", print_side, nullable=False),
        sa.Column("min_stock", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "min_stock IS NULL OR min_stock >= 0", name=op.f("ck_printed_transfers_min_stock_non_negative")
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_printed_transfers_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["print_design_id"],
            ["print_designs.id"],
            name=op.f("fk_printed_transfers_print_design_id_print_designs"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_printed_transfers")),
        sa.UniqueConstraint(
            "company_id",
            "print_design_id",
            "side",
            name="uq_printed_transfers_company_id_print_design_id_side",
        ),
    )
    op.create_index(op.f("ix_printed_transfers_company_id"), "printed_transfers", ["company_id"], unique=False)
    op.create_index(
        op.f("ix_printed_transfers_print_design_id"), "printed_transfers", ["print_design_id"], unique=False
    )

    op.create_table(
        "printed_transfer_movements",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("printed_transfer_id", sa.Uuid(), nullable=False),
        sa.Column("kind", printed_movement_kind, nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_printed_transfer_movements_quantity_positive")),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_printed_transfer_movements_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["printed_transfer_id"],
            ["printed_transfers.id"],
            name=op.f("fk_printed_transfer_movements_printed_transfer_id_printed_transfers"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_printed_transfer_movements")),
    )
    op.create_index(
        op.f("ix_printed_transfer_movements_company_id"), "printed_transfer_movements", ["company_id"], unique=False
    )
    op.create_index(
        op.f("ix_printed_transfer_movements_printed_transfer_id"),
        "printed_transfer_movements",
        ["printed_transfer_id"],
        unique=False,
    )

    op.create_table(
        "blank_piece_movements",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("blank_piece_id", sa.Uuid(), nullable=False),
        sa.Column("kind", blank_movement_kind, nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("sewing_shipment_id", sa.Uuid(), nullable=True),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_blank_piece_movements_quantity_positive")),
        sa.ForeignKeyConstraint(
            ["blank_piece_id"],
            ["blank_pieces.id"],
            name=op.f("fk_blank_piece_movements_blank_piece_id_blank_pieces"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_blank_piece_movements_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["sewing_shipment_id"],
            ["sewing_shipments.id"],
            name=op.f("fk_blank_piece_movements_sewing_shipment_id_sewing_shipments"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_blank_piece_movements")),
    )
    op.create_index(
        op.f("ix_blank_piece_movements_blank_piece_id"), "blank_piece_movements", ["blank_piece_id"], unique=False
    )
    op.create_index(op.f("ix_blank_piece_movements_company_id"), "blank_piece_movements", ["company_id"], unique=False)
    op.create_index(
        op.f("ix_blank_piece_movements_sewing_shipment_id"),
        "blank_piece_movements",
        ["sewing_shipment_id"],
        unique=False,
    )

    # --- Retire the old print_stock tier (replaced by printed_transfers) ---
    op.drop_index(op.f("ix_print_stock_movements_batch_id"), table_name="print_stock_movements")
    op.drop_index(op.f("ix_print_stock_movements_company_design_color"), table_name="print_stock_movements")
    op.drop_index(op.f("ix_print_stock_movements_company_id"), table_name="print_stock_movements")
    op.drop_index(op.f("ix_print_stock_movements_print_design_id"), table_name="print_stock_movements")
    op.drop_index(op.f("ix_print_stock_movements_product_color"), table_name="print_stock_movements")
    op.drop_table("print_stock_movements")
    # autogenerate never emits DROP TYPE — do it explicitly now the table is gone.
    print_stock_direction.drop(op.get_bind(), checkfirst=True)

    # --- Drop print_stock permissions + their grants ---
    placeholders = ", ".join(f"'{c}'" for c in _PRINT_STOCK_CODES)
    op.execute(
        f"DELETE FROM role_permissions WHERE permission_id IN "
        f"(SELECT id FROM permissions WHERE code IN ({placeholders}))"
    )
    op.execute(f"DELETE FROM permissions WHERE code IN ({placeholders})")


def downgrade() -> None:
    # --- Re-seed print_stock permissions + grants ---
    _reseed_print_stock_permissions()

    # --- Recreate the old print_stock tier (print_stock_direction enum is
    #     recreated implicitly by this inline ENUM column) ---
    op.create_table(
        "print_stock_movements",
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
        sa.Column("print_design_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("product_color", sa.VARCHAR(length=80), autoincrement=False, nullable=False),
        sa.Column(
            "direction",
            postgresql.ENUM("entry", "exit", "adjustment", name="print_stock_direction"),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("quantity", sa.INTEGER(), autoincrement=False, nullable=False),
        sa.Column("notes", sa.VARCHAR(length=500), autoincrement=False, nullable=True),
        sa.Column("batch_id", sa.UUID(), autoincrement=False, nullable=True),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_print_stock_movements_quantity_positive")),
        sa.ForeignKeyConstraint(
            ["batch_id"], ["batches.id"], name=op.f("fk_print_stock_movements_batch_id_batches"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["companies.id"], name=op.f("fk_print_stock_movements_company_id_companies")
        ),
        sa.ForeignKeyConstraint(
            ["print_design_id"],
            ["print_designs.id"],
            name=op.f("fk_print_stock_movements_print_design_id_print_designs"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_print_stock_movements")),
    )
    op.create_index(
        op.f("ix_print_stock_movements_product_color"), "print_stock_movements", ["product_color"], unique=False
    )
    op.create_index(
        op.f("ix_print_stock_movements_print_design_id"), "print_stock_movements", ["print_design_id"], unique=False
    )
    op.create_index(op.f("ix_print_stock_movements_company_id"), "print_stock_movements", ["company_id"], unique=False)
    op.create_index(
        "ix_print_stock_movements_company_design_color",
        "print_stock_movements",
        ["company_id", "print_design_id", "product_color"],
        unique=False,
    )
    op.create_index(op.f("ix_print_stock_movements_batch_id"), "print_stock_movements", ["batch_id"], unique=False)

    # --- Drop the new WIP inventory tiers (Phase-1 enums are left in place) ---
    op.drop_index(op.f("ix_blank_piece_movements_sewing_shipment_id"), table_name="blank_piece_movements")
    op.drop_index(op.f("ix_blank_piece_movements_company_id"), table_name="blank_piece_movements")
    op.drop_index(op.f("ix_blank_piece_movements_blank_piece_id"), table_name="blank_piece_movements")
    op.drop_table("blank_piece_movements")
    op.drop_index(op.f("ix_printed_transfer_movements_printed_transfer_id"), table_name="printed_transfer_movements")
    op.drop_index(op.f("ix_printed_transfer_movements_company_id"), table_name="printed_transfer_movements")
    op.drop_table("printed_transfer_movements")
    op.drop_index(op.f("ix_printed_transfers_print_design_id"), table_name="printed_transfers")
    op.drop_index(op.f("ix_printed_transfers_company_id"), table_name="printed_transfers")
    op.drop_table("printed_transfers")
    op.drop_index(op.f("ix_paper_roll_movements_paper_roll_id"), table_name="paper_roll_movements")
    op.drop_index(op.f("ix_paper_roll_movements_company_id"), table_name="paper_roll_movements")
    op.drop_table("paper_roll_movements")
    op.drop_index(op.f("ix_blank_pieces_spec_id"), table_name="blank_pieces")
    op.drop_index(op.f("ix_blank_pieces_company_id"), table_name="blank_pieces")
    op.drop_table("blank_pieces")
    op.drop_index(op.f("ix_paper_rolls_company_id"), table_name="paper_rolls")
    op.drop_table("paper_rolls")

    # --- Drop the five enum types introduced by this migration ---
    bind = op.get_bind()
    for enum in _NEW_ENUMS:
        enum.drop(bind, checkfirst=True)


def _reseed_print_stock_permissions() -> None:
    """Re-insert the print_stock permission codes + re-grant to the 3 roles.

    Mirrors the seed in ``95e36cb45a49`` (idempotent) so a downgrade restores
    the pre-Phase-2 permission state.
    """
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

    placeholders = ", ".join(f"'{c}'" for c in _PRINT_STOCK_CODES)
    existing = {row[0] for row in bind.execute(sa.text(f"SELECT code FROM permissions WHERE code IN ({placeholders})"))}
    permission_ids: dict[str, uuid.UUID] = {}
    new_rows = []
    for code, description in _PRINT_STOCK_PERMISSIONS:
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

    grant_rows = []
    for role_code in _PRINT_STOCK_GRANTS:
        role_id = bind.execute(
            sa.text("SELECT id FROM roles WHERE code = :code AND company_id IS NULL"),
            {"code": role_code},
        ).scalar()
        if role_id is None:
            continue
        for code in _PRINT_STOCK_CODES:
            already = bind.execute(
                sa.text("SELECT 1 FROM role_permissions WHERE role_id = :rid AND permission_id = :pid"),
                {"rid": role_id, "pid": permission_ids[code]},
            ).first()
            if already is None:
                grant_rows.append({"role_id": role_id, "permission_id": permission_ids[code]})
    if grant_rows:
        op.bulk_insert(role_permissions_table, grant_rows)
