"""'add print technique and tag'

Revision ID: 86d7531f48b7
Revises: 7e2e990f490b
Create Date: 2026-06-05 20:48:08.437204

"""

from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "86d7531f48b7"
down_revision: str | Sequence[str] | None = "7e2e990f490b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add NOT NULL `technique` with a temporary server_default so existing rows
    # backfill to 'dtf'; then drop the default so the app-level default governs.
    technique = postgresql.ENUM("dtf", "silkscreen", "sublimation", name="print_technique")
    technique.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "print_designs",
        sa.Column("technique", technique, nullable=False, server_default="dtf"),
    )
    op.alter_column("print_designs", "technique", server_default=None)
    op.add_column("print_designs", sa.Column("tag", sqlmodel.sql.sqltypes.AutoString(length=60), nullable=True))


def downgrade() -> None:
    op.drop_column("print_designs", "tag")
    op.drop_column("print_designs", "technique")
    postgresql.ENUM(name="print_technique").drop(op.get_bind(), checkfirst=True)
