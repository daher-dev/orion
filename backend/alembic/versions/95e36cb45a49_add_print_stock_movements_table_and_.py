"""add print_stock_movements table and seed print_stock permissions

Revision ID: 95e36cb45a49
Revises: 45010fb10777
Create Date: 2026-06-08 20:36:21.084753

"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "95e36cb45a49"
down_revision: str | Sequence[str] | None = "45010fb10777"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# The print_stock_direction PG ENUM is created implicitly by the column
# definition below (create_table emits CREATE TYPE for an inline ENUM). We
# build a non-creating handle here so downgrade can DROP TYPE explicitly —
# autogenerate never emits that.
print_stock_direction = postgresql.ENUM(
    "entry", "exit", "adjustment", name="print_stock_direction", create_type=False
)

# New permission codes seeded by this migration and the roles that receive them.
_NEW_PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("print_stock.read", "Read: Print stock (estoque de estampas / impresso)"),
    ("print_stock.write", "Write: Print stock (estoque de estampas / impresso)"),
)
# admin gets both via the role catalog already; explicitly grant to all three
# operational roles (admin/manager/operator) to mirror the stock permissions.
_GRANTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("admin", ("print_stock.read", "print_stock.write")),
    ("manager", ("print_stock.read", "print_stock.write")),
    ("operator", ("print_stock.read", "print_stock.write")),
)


def _seed_permissions() -> None:
    permissions_table = sa.table(
        "permissions",
        sa.column("id", sa.Uuid()),
        sa.column("code", sa.String()),
        sa.column("description", sa.String()),
    )
    permission_ids: dict[str, uuid.UUID] = {}
    rows = []
    for code, description in _NEW_PERMISSIONS:
        pid = uuid.uuid4()
        permission_ids[code] = pid
        rows.append({"id": pid, "code": code, "description": description})
    op.bulk_insert(permissions_table, rows)

    role_permissions_table = sa.table(
        "role_permissions",
        sa.column("role_id", sa.Uuid()),
        sa.column("permission_id", sa.Uuid()),
    )
    bind = op.get_bind()
    grant_rows = []
    for role_code, perm_codes in _GRANTS:
        role_id = bind.execute(
            sa.text("SELECT id FROM roles WHERE code = :code"), {"code": role_code}
        ).scalar()
        if role_id is None:
            # Role not seeded in this database — skip its grants.
            continue
        for perm_code in perm_codes:
            grant_rows.append({"role_id": role_id, "permission_id": permission_ids[perm_code]})
    if grant_rows:
        op.bulk_insert(role_permissions_table, grant_rows)


def upgrade() -> None:
    op.create_table(
        "print_stock_movements",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("print_design_id", sa.Uuid(), nullable=False),
        sa.Column("product_color", sqlmodel.sql.sqltypes.AutoString(length=80), nullable=False),
        sa.Column(
            "direction",
            postgresql.ENUM("entry", "exit", "adjustment", name="print_stock_direction"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("batch_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_print_stock_movements_quantity_positive")),
        sa.ForeignKeyConstraint(
            ["batch_id"],
            ["batches.id"],
            name=op.f("fk_print_stock_movements_batch_id_batches"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name=op.f("fk_print_stock_movements_company_id_companies"),
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
        op.f("ix_print_stock_movements_batch_id"), "print_stock_movements", ["batch_id"], unique=False
    )
    op.create_index(
        "ix_print_stock_movements_company_design_color",
        "print_stock_movements",
        ["company_id", "print_design_id", "product_color"],
        unique=False,
    )
    op.create_index(
        op.f("ix_print_stock_movements_company_id"), "print_stock_movements", ["company_id"], unique=False
    )
    op.create_index(
        op.f("ix_print_stock_movements_print_design_id"),
        "print_stock_movements",
        ["print_design_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_print_stock_movements_product_color"),
        "print_stock_movements",
        ["product_color"],
        unique=False,
    )

    _seed_permissions()


def downgrade() -> None:
    codes = [code for code, _ in _NEW_PERMISSIONS]
    placeholders = ", ".join(f"'{c}'" for c in codes)
    op.execute(
        f"DELETE FROM role_permissions WHERE permission_id IN "
        f"(SELECT id FROM permissions WHERE code IN ({placeholders}))"
    )
    op.execute(f"DELETE FROM permissions WHERE code IN ({placeholders})")

    op.drop_index(op.f("ix_print_stock_movements_product_color"), table_name="print_stock_movements")
    op.drop_index(op.f("ix_print_stock_movements_print_design_id"), table_name="print_stock_movements")
    op.drop_index(op.f("ix_print_stock_movements_company_id"), table_name="print_stock_movements")
    op.drop_index("ix_print_stock_movements_company_design_color", table_name="print_stock_movements")
    op.drop_index(op.f("ix_print_stock_movements_batch_id"), table_name="print_stock_movements")
    op.drop_table("print_stock_movements")
    print_stock_direction.drop(op.get_bind(), checkfirst=True)
