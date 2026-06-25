"""make sewing_shipments.cutting_order_id nullable

Legacy (base44) remessas frequently reference a cutting order that was deleted
or never exported. The shipment itself (contractor + product + sizes) is real,
so it is imported standalone with a NULL cutting_order_id. Manually-created
shipments still always carry the link (enforced at the schema layer).

Revision ID: b7d2c9a4e1f3
Revises: eb1bb6874fd0
Create Date: 2026-06-24 21:40:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7d2c9a4e1f3"
down_revision: str | Sequence[str] | None = "eb1bb6874fd0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "sewing_shipments",
        "cutting_order_id",
        existing_type=sa.Uuid(),
        nullable=True,
    )


def downgrade() -> None:
    # Re-tightening requires every shipment to have a cutting order; NULL rows
    # (legacy standalone remessas) would need backfilling first.
    op.alter_column(
        "sewing_shipments",
        "cutting_order_id",
        existing_type=sa.Uuid(),
        nullable=False,
    )
