"""add supplies

Creates the consumable-supply (insumos) catalog + its append-only movement
ledger, and seeds the ``supplies.read`` / ``supplies.write`` permission codes,
granting them to the admin / manager / operator roles.

Revision ID: 50f7cf46097a
Revises: bc63b4a72462
Create Date: 2026-06-08 23:07:26.144251

"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "50f7cf46097a"
down_revision: str | Sequence[str] | None = "bc63b4a72462"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# The supply_movement_kind PG ENUM is created implicitly by the column
# definition below (create_table emits CREATE TYPE for an inline ENUM). We build
# a non-creating handle here so downgrade can DROP TYPE explicitly — autogenerate
# never emits that.
supply_movement_kind = postgresql.ENUM("entry", "exit", "adjustment", name="supply_movement_kind", create_type=False)

# New permission codes seeded by this migration and the roles that receive them.
# The seed-roles migration (3187f02cbc35) already ran, so these codes are NOT in
# its catalog — they must be inserted here (mirroring the print_stock migration).
_NEW_PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("supplies.read", "Read: Consumable supplies (insumos)"),
    ("supplies.write", "Write: Consumable supplies (insumos)"),
)
_GRANTS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("admin", ("supplies.read", "supplies.write")),
    ("manager", ("supplies.read", "supplies.write")),
    ("operator", ("supplies.read", "supplies.write")),
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
        # Grant to every role with this code (global + any per-company custom
        # roles that happen to share the code — defensive, matches print_stock).
        role_ids = [
            row[0]
            for row in bind.execute(sa.text("SELECT id FROM roles WHERE code = :code"), {"code": role_code}).all()
        ]
        for role_id in role_ids:
            for perm_code in perm_codes:
                grant_rows.append({"role_id": role_id, "permission_id": permission_ids[perm_code]})
    if grant_rows:
        op.bulk_insert(role_permissions_table, grant_rows)


def upgrade() -> None:
    op.create_table(
        "supplies",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=False),
        sa.Column("unit", sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False),
        sa.Column("unit_cost", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("min_stock", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.CheckConstraint("min_stock IS NULL OR min_stock >= 0", name=op.f("ck_supplies_min_stock_non_negative")),
        sa.CheckConstraint("unit_cost >= 0", name=op.f("ck_supplies_unit_cost_non_negative")),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name=op.f("fk_supplies_company_id_companies"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_supplies")),
    )
    op.create_index(op.f("ix_supplies_company_id"), "supplies", ["company_id"], unique=False)

    op.create_table(
        "supply_movements",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("supply_id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind",
            postgresql.ENUM("entry", "exit", "adjustment", name="supply_movement_kind"),
            nullable=False,
        ),
        sa.Column("quantity", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column("notes", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.CheckConstraint("quantity > 0", name=op.f("ck_supply_movements_quantity_positive")),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["companies.id"],
            name=op.f("fk_supply_movements_company_id_companies"),
        ),
        sa.ForeignKeyConstraint(
            ["supply_id"],
            ["supplies.id"],
            name=op.f("fk_supply_movements_supply_id_supplies"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_supply_movements")),
    )
    op.create_index(op.f("ix_supply_movements_company_id"), "supply_movements", ["company_id"], unique=False)
    op.create_index(op.f("ix_supply_movements_supply_id"), "supply_movements", ["supply_id"], unique=False)

    _seed_permissions()


def downgrade() -> None:
    codes = [code for code, _ in _NEW_PERMISSIONS]
    placeholders = ", ".join(f"'{c}'" for c in codes)
    op.execute(
        f"DELETE FROM role_permissions WHERE permission_id IN "
        f"(SELECT id FROM permissions WHERE code IN ({placeholders}))"
    )
    op.execute(f"DELETE FROM permissions WHERE code IN ({placeholders})")

    op.drop_index(op.f("ix_supply_movements_supply_id"), table_name="supply_movements")
    op.drop_index(op.f("ix_supply_movements_company_id"), table_name="supply_movements")
    op.drop_table("supply_movements")
    op.drop_index(op.f("ix_supplies_company_id"), table_name="supplies")
    op.drop_table("supplies")
    supply_movement_kind.drop(op.get_bind(), checkfirst=True)
