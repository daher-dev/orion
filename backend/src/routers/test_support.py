"""Test-support endpoints — mounted only outside production.

Rationale
---------
Some domain invariants are intentionally irreversible: once an order ships we
write an append-only ``StockExit`` (ledger integrity), and ``DELETE /v1/orders``
is permanently blocked thereafter. That is correct for production, but it means
the E2E suite cannot return to a clean slate through the normal API — shipped
orders accumulate on any persistent database, making the suite non-idempotent
(e.g. the orders "empty state" test depends on zero orders existing).

CI papers over this by dropping/recreating the database per run via
``scripts/reset-test-db.sh``. This endpoint makes the suite self-sufficient on
*any* database: it truncates tenant data tables while preserving the auth
scaffold (companies, users, roles, permissions, invites) so the bootstrapped
dev-bypass user keeps working across resets.

Safety
------
The router is included in ``main.create_app`` only when ``config.ENV != "prd"``,
and the handler re-checks the env as defence in depth. It is never reachable in
production.
"""

from fastapi import APIRouter, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlmodel import select

from config import config
from dependencies import CurrentClaims, CurrentDbUser, DbSession
from models import User
from shared.exceptions import AuthorizationError

router = APIRouter(prefix="/test-support", tags=["test-support"])

# Tenant-scoped data tables wiped on reset, in no particular order (a single
# TRUNCATE ... CASCADE handles FK ordering). The auth/identity scaffold —
# companies, users, roles, permissions, role_permissions, invites — is
# deliberately preserved so the bootstrapped dev-bypass user survives a reset.
_DATA_TABLES: tuple[str, ...] = (
    "ads",
    "audit_logs",
    "clients",
    "cutting_order_outputs",
    "cutting_orders",
    "fabric_rolls",
    "orders",
    "print_designs",
    "product_specs",
    "product_variations",
    "products",
    "sewing_contractors",
    "sewing_shipment_items",
    "sewing_shipments",
    "spec_trims",
    "stock_entries",
    "stock_exits",
)


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT)
async def reset_data(claims: CurrentClaims, db: DbSession) -> None:
    """Truncate all tenant data tables. Non-prod only, authenticated.

    Requires a valid identity (Firebase token or dev-bypass) so it can't be
    triggered anonymously even outside prod. Preserves
    companies/users/roles/permissions/invites so a previously bootstrapped
    identity keeps resolving after the reset.
    """
    if config.ENV == "prd":
        # Defence in depth — the router isn't mounted in prod, but never allow it.
        raise AuthorizationError(detail="Not available in production")

    quoted = ", ".join(f'"{t}"' for t in _DATA_TABLES)
    conn = await db.connection()
    await conn.execute(text(f"TRUNCATE {quoted} RESTART IDENTITY CASCADE"))
    await db.commit()


class SetOperatorBody(BaseModel):
    value: bool = True


@router.post("/set-operator", status_code=status.HTTP_204_NO_CONTENT)
async def set_operator(body: SetOperatorBody, user: CurrentDbUser, db: DbSession) -> None:
    """Flip the caller's ``is_operator`` flag. Non-prod only.

    Lets the Console E2E suite self-provision a platform operator (and reset the
    flag afterwards) without a dedicated seed, since the dev-bypass identity is a
    plain tenant admin by default.
    """
    if config.ENV == "prd":
        raise AuthorizationError(detail="Not available in production")
    rows = (await db.exec(select(User).where(User.firebase_uid == user.firebase_uid))).all()
    for row in rows:
        row.is_operator = body.value
        db.add(row)
    await db.commit()
