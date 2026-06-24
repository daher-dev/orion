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
from dependencies import CurrentDbUser, DbSession
from models import User
from shared.exceptions import AuthorizationError

router = APIRouter(prefix="/test-support", tags=["test-support"])

# Child tables that lack a direct company_id — scoped via their parent. Deleted
# before the company_id-scoped tables below so FK references resolve.
_CHILD_DELETES: tuple[tuple[str, str], ...] = (
    ("sewing_shipment_items", "shipment_id IN (SELECT id FROM sewing_shipments WHERE company_id = :cid)"),
    ("cutting_order_outputs", "cutting_order_id IN (SELECT id FROM cutting_orders WHERE company_id = :cid)"),
    ("print_order_outputs", "print_order_id IN (SELECT id FROM print_orders WHERE company_id = :cid)"),
    ("spec_trims", "spec_id IN (SELECT id FROM product_specs WHERE company_id = :cid)"),
)

# Tenant data tables in FK-safe (children-before-parents) order, all carrying a
# company_id. Mirrors the importer's per-company wipe (scripts/base44/load.py) so
# the ordering stays correct against every RESTRICT FK. The auth/identity scaffold
# (companies, users, roles, permissions, invites) and `company_settings` (the
# tenant's catalog config) are deliberately preserved across a reset.
_TENANT_TABLES: tuple[str, ...] = (
    "audit_logs",
    "stock_exits",
    "stock_entries",
    "assembly_runs",
    "print_orders",
    "blank_piece_movements",
    "blank_pieces",
    "printed_transfer_movements",
    "printed_transfers",
    "print_design_variations",
    "paper_roll_movements",
    "paper_rolls",
    "fabric_roll_movements",
    "sewing_shipments",
    "cutting_orders",
    "order_items",
    "imported_orders",
    "orders",
    "batches",
    "ad_products",
    "ads",
    "product_variations",
    "products",
    "product_specs",
    "print_designs",
    "fabric_rolls",
    "sewing_contractors",
    "clients",
)


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT)
async def reset_data(user: CurrentDbUser, db: DbSession) -> None:
    """Wipe the *caller's tenant* data. Non-prod only, authenticated.

    Scoped to the caller's ``company_id`` (not a global truncate) so parallel
    E2E workers — each in its own tenant — can reset between tests without
    clobbering one another. Preserves companies/users/roles/permissions/invites
    and the tenant's ``company_settings`` so the identity + catalog config keep
    resolving after the reset.
    """
    if config.ENV == "prd":
        # Defence in depth — the router isn't mounted in prod, but never allow it.
        raise AuthorizationError(detail="Not available in production")

    cid = user.company_id
    conn = await db.connection()
    for table, predicate in _CHILD_DELETES:
        await conn.execute(text(f"DELETE FROM {table} WHERE {predicate}"), {"cid": cid})
    for table in _TENANT_TABLES:
        await conn.execute(text(f"DELETE FROM {table} WHERE company_id = :cid"), {"cid": cid})
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
