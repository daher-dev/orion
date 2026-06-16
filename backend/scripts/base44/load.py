"""Load converted rows into Orion — multi-company, wipe-and-reload, one txn.

Per run:
1. Upsert the imported companies (deterministic ids; unique subdomains).
2. For each imported company, wipe its business data + the *imported* user/invite
   cohort (firebase_uid ``base44:`` / token ``base44-``), preserving the company,
   roles, and any real users/invites.
3. Get-or-create imported users (by deterministic id and by email) + a pending
   invite each, so they appear immediately and bind on first real login.
4. Insert business rows in foreign-key order.

The caller commits, so wipe+load is atomic — a failure leaves the DB untouched.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    Ad,
    AdProduct,
    Batch,
    Client,
    Company,
    CuttingOrder,
    CuttingOrderOutput,
    FabricRoll,
    ImportedOrder,
    Invite,
    Order,
    OrderItem,
    PrintDesign,
    Product,
    ProductSpec,
    ProductVariation,
    Role,
    SewingContractor,
    SewingShipment,
    SewingShipmentItem,
    SpecTrim,
    StockEntry,
    StockExit,
    User,
)
from scripts.base44 import settings
from scripts.base44.mappings import TABLE_ORDER, ConversionReport, ConvertedData

_INVITE_TOKEN_PREFIX = "base44-"
_INVITE_TTL = timedelta(days=3650)

TABLE_MODELS: dict[str, type] = {
    "product_spec": ProductSpec,
    "spec_trim": SpecTrim,
    "print_design": PrintDesign,
    "product": Product,
    "product_variation": ProductVariation,
    "fabric_roll": FabricRoll,
    "cutting_order": CuttingOrder,
    "cutting_order_output": CuttingOrderOutput,
    "sewing_contractor": SewingContractor,
    "sewing_shipment": SewingShipment,
    "sewing_shipment_item": SewingShipmentItem,
    "client": Client,
    "batch": Batch,
    "ad": Ad,
    "ad_products": AdProduct,
    "order": Order,
    "order_item": OrderItem,
    "imported_order": ImportedOrder,
    "stock_entry": StockEntry,
    "stock_exit": StockExit,
}

# Business tables to clear per company each run (children before parents).
_CHILD_DELETES: tuple[tuple[str, str], ...] = (
    ("sewing_shipment_items", "shipment_id IN (SELECT id FROM sewing_shipments WHERE company_id = :cid)"),
    ("cutting_order_outputs", "cutting_order_id IN (SELECT id FROM cutting_orders WHERE company_id = :cid)"),
    ("spec_trims", "spec_id IN (SELECT id FROM product_specs WHERE company_id = :cid)"),
)
_TENANT_TABLES: tuple[str, ...] = (
    "audit_logs",
    "stock_exits",
    "stock_entries",
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


def _clean(row: dict) -> dict:
    return {k: v for k, v in row.items() if not k.startswith("_")}


async def _roles_by_code(db: AsyncSession) -> dict[str, uuid.UUID]:
    rows = (await db.exec(select(Role))).all()
    if not rows:
        raise SystemExit("No roles seeded — run migrations first (alembic upgrade head).")
    return {r.code: r.id for r in rows}


async def upsert_companies(db: AsyncSession, companies: list[dict]) -> None:
    existing_subdomains = set((await db.exec(select(Company.subdomain))).all())
    for row in companies:
        clean = _clean(row)
        current = (await db.exec(select(Company).where(Company.id == clean["id"]))).first()
        if current is not None:
            current.name = clean["name"]
            current.main_color = clean["main_color"]
            db.add(current)
            continue
        slug, base, i = clean["subdomain"], clean["subdomain"], 1
        while slug in existing_subdomains:
            i += 1
            slug = f"{base[:60]}-{i}"
        existing_subdomains.add(slug)
        clean["subdomain"] = slug
        db.add(Company(**clean))
    await db.flush()


async def wipe_company(db: AsyncSession, company_id: uuid.UUID) -> None:
    conn = await db.connection()
    for table, predicate in _CHILD_DELETES:
        await conn.execute(text(f"DELETE FROM {table} WHERE {predicate}"), {"cid": company_id})
    for table in _TENANT_TABLES:
        await conn.execute(text(f"DELETE FROM {table} WHERE company_id = :cid"), {"cid": company_id})
    await conn.execute(
        text("DELETE FROM invites WHERE company_id = :cid AND token LIKE :p"),
        {"cid": company_id, "p": f"{_INVITE_TOKEN_PREFIX}%"},
    )
    await conn.execute(
        text("DELETE FROM users WHERE company_id = :cid AND firebase_uid LIKE :p"),
        {"cid": company_id, "p": f"{settings.IMPORTED_UID_PREFIX}%"},
    )


async def _load_users(
    db: AsyncSession, users: list[dict], roles: dict[str, uuid.UUID], report: ConversionReport
) -> None:
    default_role = roles.get(settings.DEFAULT_ROLE_CODE) or next(iter(roles.values()))
    inserted = 0
    for row in users:
        company_id = row["company_id"]
        email = row["email"]
        role_id = roles.get(row.get("_role_code"), default_role)
        by_id = (await db.exec(select(User).where(User.id == row["id"]))).first()
        by_email = (await db.exec(select(User).where(User.company_id == company_id, User.email.ilike(email)))).first()
        if by_id is not None or by_email is not None:
            continue  # preserved real/rebound user
        clean = _clean(row)
        clean["role_id"] = role_id
        db.add(User(**clean))
        inserted += 1
        pending = (
            await db.exec(
                select(Invite).where(
                    Invite.company_id == company_id,
                    Invite.email.ilike(email),
                    Invite.accepted_at.is_(None),
                )
            )
        ).first()
        if pending is None:
            db.add(
                Invite(
                    company_id=company_id,
                    token=f"{_INVITE_TOKEN_PREFIX}{secrets.token_urlsafe(24)}",
                    email=email,
                    role_id=role_id,
                    invited_by_id=None,
                    expires_at=datetime.now(UTC) + _INVITE_TTL,
                )
            )
    await db.flush()
    report.inserted["user"] = inserted


async def link_existing_users_to_company(db: AsyncSession, *, subdomain: str, report: ConversionReport) -> None:
    """Add every pre-existing *real* user (firebase_uid not a ``base44:`` placeholder)
    as a member of ``subdomain`` so they can access the imported data.

    If that company already has an imported placeholder with the same email, the
    placeholder is rebound to the real uid instead of inserting a duplicate (which
    would violate the (company_id, email) unique constraint). Each real identity
    keeps its highest existing role.
    """
    company = (await db.exec(select(Company).where(Company.subdomain == subdomain))).first()
    if company is None:
        report.notes.append(f"link-users: company '{subdomain}' not found — skipped")
        return
    rows = (
        await db.exec(
            select(User, Role.code)
            .join(Role, Role.id == User.role_id)
            .where(~User.firebase_uid.like(f"{settings.IMPORTED_UID_PREFIX}%"))
        )
    ).all()
    rank = {"admin": 3, "manager": 2, "operator": 1}
    identities: dict[str, dict] = {}
    for user, role_code in rows:
        cur = identities.get(user.firebase_uid)
        if cur is None or rank.get(role_code, 0) > rank.get(cur["role_code"], 0):
            identities[user.firebase_uid] = {
                "uid": user.firebase_uid,
                "email": user.email,
                "name": user.name,
                "role_code": role_code,
            }

    roles = await _roles_by_code(db)
    default_role = roles.get(settings.DEFAULT_ROLE_CODE) or next(iter(roles.values()))
    added, rebound = 0, 0
    for ident in identities.values():
        if (
            await db.exec(select(User).where(User.company_id == company.id, User.firebase_uid == ident["uid"]))
        ).first() is not None:
            continue  # already a member
        role_id = roles.get(ident["role_code"], default_role)
        placeholder = (
            await db.exec(select(User).where(User.company_id == company.id, User.email.ilike(ident["email"])))
        ).first()
        if placeholder is not None:
            placeholder.firebase_uid = ident["uid"]
            placeholder.role_id = role_id
            db.add(placeholder)
            rebound += 1
        else:
            db.add(
                User(
                    company_id=company.id,
                    firebase_uid=ident["uid"],
                    name=ident["name"],
                    email=ident["email"],
                    role_id=role_id,
                )
            )
            added += 1
    await db.flush()
    report.inserted["linked_users"] = added + rebound
    report.notes.append(f"link-users: {subdomain} — {added} added, {rebound} rebound from imported placeholders")


async def load(
    db: AsyncSession,
    *,
    data: ConvertedData,
    report: ConversionReport,
    link_users_subdomain: str | None = None,
) -> None:
    """Upsert companies, wipe each, then insert users + business rows (caller commits)."""
    roles = await _roles_by_code(db)
    await upsert_companies(db, data.companies)
    report.inserted["company"] = len(data.companies)

    for company_id in data.company_ids:
        await wipe_company(db, company_id)

    await _load_users(db, data.users, roles, report)

    for table in TABLE_ORDER:
        rows = data.rows.get(table, [])
        report.inserted[table] = len(rows)
        if not rows:
            continue
        # Core multi-row INSERT (executemany) rather than ORM add_all: no per-row
        # RETURNING round-trips, which is dramatically faster over a remote link
        # (Neon). id is supplied explicitly; created_at/updated_at use their
        # server defaults.
        await db.execute(TABLE_MODELS[table].__table__.insert(), [_clean(r) for r in rows])

    if link_users_subdomain:
        await link_existing_users_to_company(db, subdomain=link_users_subdomain, report=report)
