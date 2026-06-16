"""'phase5 nullable cutting body roll'

Revision ID: e9cc009f9dbf
Revises: ad49a8465c6f
Create Date: 2026-06-15 14:48:50.432138

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e9cc009f9dbf"
down_revision: str | Sequence[str] | None = "ad49a8465c6f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Phase 5 (Planning): a planning-created PENDING corte carries no roll yet —
    # the operator assigns one in the Corte edit flow before the order reaches
    # DONE (the DONE transition rejects a null body roll). Make body_roll_id
    # nullable and add a guard so a rib roll can never exist without a body.
    op.alter_column(
        "cutting_orders",
        "body_roll_id",
        existing_type=sa.UUID(),
        nullable=True,
    )
    op.create_check_constraint(
        "rib_requires_body",
        "cutting_orders",
        "rib_roll_id IS NULL OR body_roll_id IS NOT NULL",
    )


def downgrade() -> None:
    # Drop the guard first, then re-require body_roll_id (fails if NULL rows
    # exist — acceptable, no backward-compat).
    op.drop_constraint("rib_requires_body", "cutting_orders", type_="check")
    op.alter_column(
        "cutting_orders",
        "body_roll_id",
        existing_type=sa.UUID(),
        nullable=False,
    )
