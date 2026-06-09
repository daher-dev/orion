"""seed reports.read and reports.write permissions and grant to admin/manager

Permission-only seed (no schema change). Introduces the ``reports.read`` /
``reports.write`` permission codes so a dedicated reports/analytics domain
exists going forward, and grants both to the global ``admin`` and ``manager``
roles. The turnover endpoint itself is gated on ``stock.read`` (which every
seeded role already has), so this migration does not change who can reach the
existing report routes — it only adds the new codes.

Revision ID: 2a6589a47ac1
Revises: f6cb947bdbce
Create Date: 2026-06-09 00:00:00.000000

"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2a6589a47ac1"
down_revision: str | Sequence[str] | None = "f6cb947bdbce"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (code, description) for the new permission domain.
NEW_PERMISSIONS: tuple[tuple[str, str], ...] = (
    ("reports.read", "Read: Reports and analytics"),
    ("reports.write", "Write: Reports and analytics"),
)

# Global roles (company_id IS NULL) that receive the new permissions.
GRANT_TO_ROLES: tuple[str, ...] = ("admin", "manager")


def upgrade() -> None:
    bind = op.get_bind()

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

    # Insert the two new permission codes (skip any already present so the
    # migration is safe to re-run on a partially-seeded DB).
    existing_codes = {
        row[0]
        for row in bind.execute(sa.text("SELECT code FROM permissions WHERE code IN ('reports.read', 'reports.write')"))
    }
    permission_ids: dict[str, uuid.UUID] = {}
    new_rows = []
    for code, description in NEW_PERMISSIONS:
        if code in existing_codes:
            pid = bind.execute(
                sa.text("SELECT id FROM permissions WHERE code = :code"),
                {"code": code},
            ).scalar()
            permission_ids[code] = pid
            continue
        pid = uuid.uuid4()
        permission_ids[code] = pid
        new_rows.append({"id": pid, "code": code, "description": description})
    if new_rows:
        op.bulk_insert(permissions_table, new_rows)

    # Grant both codes to the global admin + manager roles.
    grant_rows = []
    for role_code in GRANT_TO_ROLES:
        role_id = bind.execute(
            sa.text("SELECT id FROM roles WHERE code = :code AND company_id IS NULL"),
            {"code": role_code},
        ).scalar()
        if role_id is None:
            continue
        for code in ("reports.read", "reports.write"):
            already = bind.execute(
                sa.text("SELECT 1 FROM role_permissions WHERE role_id = :rid AND permission_id = :pid"),
                {"rid": role_id, "pid": permission_ids[code]},
            ).first()
            if already is None:
                grant_rows.append({"role_id": role_id, "permission_id": permission_ids[code]})
    if grant_rows:
        op.bulk_insert(role_permissions_table, grant_rows)


def downgrade() -> None:
    # Remove the grants then the two new permission codes. Leave every other
    # permission/role intact (do NOT touch the base domain seed).
    op.execute(
        "DELETE FROM role_permissions WHERE permission_id IN "
        "(SELECT id FROM permissions WHERE code IN ('reports.read', 'reports.write'))"
    )
    op.execute("DELETE FROM permissions WHERE code IN ('reports.read', 'reports.write')")
