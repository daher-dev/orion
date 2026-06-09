"""add company_id to roles for custom per-company roles

Revision ID: 45010fb10777
Revises: a8c49317fdb9
Create Date: 2026-06-08 20:07:11.991916

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "45010fb10777"
down_revision: str | Sequence[str] | None = "a8c49317fdb9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add the nullable owner FK: NULL = global seeded role, non-NULL = custom
    # tenant role. Codes are no longer globally unique — uniqueness moves to the
    # composite (company_id, code) so two companies can each define e.g. `sales`.
    op.add_column("roles", sa.Column("company_id", sa.Uuid(), nullable=True))
    op.drop_index(op.f("ix_roles_code"), table_name="roles")
    op.create_index(op.f("ix_roles_code"), "roles", ["code"], unique=False)
    op.create_index(op.f("ix_roles_company_id"), "roles", ["company_id"], unique=False)
    op.create_unique_constraint("uq_roles_company_id_code", "roles", ["company_id", "code"])
    op.create_foreign_key(
        op.f("fk_roles_company_id_companies"),
        "roles",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # Restores the global unique index on `code`. Safe only when no duplicate
    # codes exist across companies (true immediately after upgrade with only the
    # 3 seeded globals).
    op.drop_constraint(op.f("fk_roles_company_id_companies"), "roles", type_="foreignkey")
    op.drop_constraint("uq_roles_company_id_code", "roles", type_="unique")
    op.drop_index(op.f("ix_roles_company_id"), table_name="roles")
    op.drop_index(op.f("ix_roles_code"), table_name="roles")
    op.create_index(op.f("ix_roles_code"), "roles", ["code"], unique=True)
    op.drop_column("roles", "company_id")
