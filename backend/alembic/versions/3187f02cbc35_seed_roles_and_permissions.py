"""seed roles and permissions

Revision ID: 3187f02cbc35
Revises: feea7ff730da
Create Date: 2026-05-06 20:52:43.878412

"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3187f02cbc35"
down_revision: str | Sequence[str] | None = "feea7ff730da"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Catalog of permissions: one read + one write per domain feature.
DOMAINS: tuple[tuple[str, str], ...] = (
    ("companies", "Company settings"),
    ("users", "Users and their assignments"),
    ("roles", "Roles and permissions"),
    ("clients", "Sales clients"),
    ("contractors", "Sewing contractors (bancas)"),
    ("prints", "Print designs (estampas)"),
    ("specs", "Product specs (fichas técnicas)"),
    ("products", "Products and variations"),
    ("ads", "Ecommerce ads"),
    ("fabric", "Fabric rolls (bobinas)"),
    ("cutting", "Cutting orders"),
    ("sewing", "Sewing shipments (remessas)"),
    ("stock", "Stock entries and exits"),
    ("orders", "Sales orders"),
)

ROLES: tuple[tuple[str, str, str, list[str]], ...] = (
    (
        "admin",
        "Administrator",
        "Full read/write across the company.",
        ["*.read", "*.write"],
    ),
    (
        "manager",
        "Manager",
        "Read/write on operations; read-only on roles/users.",
        [
            "clients.read",
            "clients.write",
            "contractors.read",
            "contractors.write",
            "prints.read",
            "prints.write",
            "specs.read",
            "specs.write",
            "products.read",
            "products.write",
            "ads.read",
            "ads.write",
            "fabric.read",
            "fabric.write",
            "cutting.read",
            "cutting.write",
            "sewing.read",
            "sewing.write",
            "stock.read",
            "stock.write",
            "orders.read",
            "orders.write",
            "companies.read",
            "users.read",
            "roles.read",
        ],
    ),
    (
        "operator",
        "Operator",
        "Production-floor user: read/write on cutting, sewing, stock; read-only elsewhere.",
        [
            "fabric.read",
            "cutting.read",
            "cutting.write",
            "sewing.read",
            "sewing.write",
            "stock.read",
            "stock.write",
            "products.read",
            "specs.read",
            "prints.read",
        ],
    ),
)


def _expand(codes: list[str]) -> list[str]:
    expanded: list[str] = []
    for code in codes:
        if code == "*.read":
            expanded.extend(f"{d}.read" for d, _ in DOMAINS)
        elif code == "*.write":
            expanded.extend(f"{d}.write" for d, _ in DOMAINS)
        else:
            expanded.append(code)
    return expanded


def upgrade() -> None:
    permissions_table = sa.table(
        "permissions",
        sa.column("id", sa.Uuid()),
        sa.column("code", sa.String()),
        sa.column("description", sa.String()),
    )
    roles_table = sa.table(
        "roles",
        sa.column("id", sa.Uuid()),
        sa.column("code", sa.String()),
        sa.column("name", sa.String()),
        sa.column("description", sa.String()),
    )
    role_permissions_table = sa.table(
        "role_permissions",
        sa.column("role_id", sa.Uuid()),
        sa.column("permission_id", sa.Uuid()),
    )

    permission_ids: dict[str, uuid.UUID] = {}
    permission_rows = []
    for domain, description in DOMAINS:
        for action in ("read", "write"):
            code = f"{domain}.{action}"
            pid = uuid.uuid4()
            permission_ids[code] = pid
            permission_rows.append(
                {
                    "id": pid,
                    "code": code,
                    "description": f"{action.capitalize()}: {description}",
                }
            )
    op.bulk_insert(permissions_table, permission_rows)

    role_rows = []
    role_permission_rows = []
    for code, name, description, perm_codes in ROLES:
        rid = uuid.uuid4()
        role_rows.append({"id": rid, "code": code, "name": name, "description": description})
        for perm_code in _expand(perm_codes):
            role_permission_rows.append({"role_id": rid, "permission_id": permission_ids[perm_code]})
    op.bulk_insert(roles_table, role_rows)
    op.bulk_insert(role_permissions_table, role_permission_rows)


def downgrade() -> None:
    op.execute("DELETE FROM role_permissions")
    op.execute("DELETE FROM roles WHERE code IN ('admin', 'manager', 'operator')")
    codes = [f"{d}.{a}" for d, _ in DOMAINS for a in ("read", "write")]
    placeholders = ", ".join(f"'{c}'" for c in codes)
    op.execute(f"DELETE FROM permissions WHERE code IN ({placeholders})")
