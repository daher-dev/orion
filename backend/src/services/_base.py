"""Shared service helpers.

Service convention
------------------
- Take primitives + ``AsyncSession`` only — never FastAPI types.
- Positional args: ``db, company_id, user_id, ...`` for tenant-scoped operations.
- Always raise typed exceptions from ``shared.exceptions`` (NotFoundError, ConflictError, …).
- After any mutation that should be auditable, call ``write_audit`` from ``services._audit``.
- Use :func:`scoped` to enforce tenant filtering on every SELECT.
"""

import uuid

from models import CompanyModel


def scoped(stmt, model: type[CompanyModel], company_id: uuid.UUID):
    """Add a ``company_id`` filter to a SELECT for the given tenant-scoped model."""

    return stmt.where(model.company_id == company_id)
