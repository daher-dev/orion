"""Canonical catalog of seeded permissions and global roles.

Single source of truth shared by:
- the seed migration ``3187f02cbc35_seed_roles_and_permissions.py``
- the test harness (``tests/conftest.py``), which re-seeds the 3 global roles
  after each truncate (the ``roles.company_id`` FK makes them part of the
  ``TRUNCATE companies CASCADE`` blast radius).

Keep this in sync with the permissions enforced by routers.
"""

# One read + one write permission per domain feature.
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
    ("print_stock", "Print stock (estoque de estampas / impresso)"),
    ("paper", "Paper/film rolls (bobinas de papel)"),
    ("blank_stock", "Blank pieces (peças lisas)"),
    ("printed_stock", "Printed transfers (estampados)"),
    ("print_orders", "Print orders (ordens de impressão)"),
    ("assembly", "Assembly (montagem)"),
    ("planning", "Production planning (planejamento)"),
    ("supplies", "Consumable supplies (insumos)"),
    ("orders", "Sales orders"),
    ("reports", "Reports and analytics"),
    ("integrations", "Marketplace channel integrations"),
    ("billing", "Plans, subscription and billing"),
)

# Global seeded roles: (code, name, description, permission_codes). ``*.read`` /
# ``*.write`` expand to every domain via :func:`expand_codes`.
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
            "print_stock.read",
            "print_stock.write",
            "paper.read",
            "paper.write",
            "blank_stock.read",
            "blank_stock.write",
            "printed_stock.read",
            "printed_stock.write",
            "print_orders.read",
            "print_orders.write",
            "assembly.read",
            "assembly.write",
            "planning.read",
            "planning.write",
            "supplies.read",
            "supplies.write",
            "orders.read",
            "orders.write",
            "reports.read",
            "reports.write",
            "integrations.read",
            "billing.read",
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
            "print_stock.read",
            "print_stock.write",
            "paper.read",
            "paper.write",
            "blank_stock.read",
            "blank_stock.write",
            "printed_stock.read",
            "printed_stock.write",
            "print_orders.read",
            "print_orders.write",
            "assembly.read",
            "assembly.write",
            "planning.read",
            "supplies.read",
            "supplies.write",
            "products.read",
            "specs.read",
            "prints.read",
            "billing.read",
        ],
    ),
)


def expand_codes(codes: list[str]) -> list[str]:
    """Expand ``*.read`` / ``*.write`` wildcards into per-domain codes."""
    expanded: list[str] = []
    for code in codes:
        if code == "*.read":
            expanded.extend(f"{d}.read" for d, _ in DOMAINS)
        elif code == "*.write":
            expanded.extend(f"{d}.write" for d, _ in DOMAINS)
        else:
            expanded.append(code)
    return expanded


# (code, name, description, fully-expanded permission codes) for the 3 globals.
GLOBAL_ROLE_SPECS: tuple[tuple[str, str, str, list[str]], ...] = tuple(
    (code, name, description, expand_codes(perm_codes)) for code, name, description, perm_codes in ROLES
)
