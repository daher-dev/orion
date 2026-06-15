"""Seed the local Orion database with realistic demo data.

Idempotent: if the demo company already exists it (and all of its tenant-scoped
rows) is wiped before being re-seeded, so re-running this script is safe.

Usage::

    cd backend && uv run python scripts/seed_dev.py
"""

import asyncio
import sys
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

# Make `src/` importable when run as `python scripts/seed_dev.py`.
_BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_BACKEND_DIR / "src"))
sys.path.insert(0, str(_BACKEND_DIR))

from sqlalchemy import text  # noqa: E402
from sqlmodel import select  # noqa: E402
from sqlmodel.ext.asyncio.session import AsyncSession  # noqa: E402

from database import get_session_factory  # noqa: E402
from models import (  # noqa: E402
    Ad,
    Client,
    Company,
    CuttingOrder,
    CuttingOrderOutput,
    FabricRoll,
    Order,
    PaperRoll,
    PaperType,
    PrintDesign,
    PrintDesignVariation,
    PrintOrder,
    PrintOrderOutput,
    PrintOrderStatus,
    PrintSide,
    PrintTechnique,
    Product,
    ProductSpec,
    ProductVariation,
    Role,
    SewingContractor,
    SewingShipment,
    SewingShipmentItem,
    StockEntry,
    User,
)
from tests.fixtures.seed_data import (  # noqa: E402
    ADS,
    CLIENTS,
    COMPANY,
    CUTTING_ORDERS,
    FABRIC_ROLLS,
    ORDERS,
    PRINT_DESIGNS,
    PRODUCT_SPECS,
    PRODUCTS,
    SEWING_CONTRACTORS,
    SEWING_SHIPMENTS,
    STOCK_ENTRIES,
    USERS,
)


async def _wipe_existing_company(db: AsyncSession, subdomain: str) -> None:
    existing = (await db.exec(select(Company).where(Company.subdomain == subdomain))).first()
    if existing is None:
        return
    conn = await db.connection()
    # Tenant-scoped tables (each has a company_id column).
    tenant_tables = (
        "audit_logs",
        "stock_exits",
        "stock_entries",
        # Assembly + print orders before their input/parent tiers (RESTRICT FKs to
        # blank_pieces / printed_transfers / product_variations / print_designs /
        # paper_rolls). Movement rows carry SET NULL provenance to these, so the
        # ledgers below can be deleted in any order relative to them.
        "assembly_runs",
        "print_orders",
        # WIP inventory tiers — ledgers before balances, balances before their
        # parent specs/designs (RESTRICT FKs).
        "blank_piece_movements",
        "blank_pieces",
        "printed_transfer_movements",
        "printed_transfers",
        "print_design_variations",
        "paper_roll_movements",
        "paper_rolls",
        "company_settings",
        "sewing_shipments",
        "cutting_orders",
        "batches",
        "orders",
        "ads",
        "product_variations",
        "products",
        "product_specs",
        "print_designs",
        "fabric_rolls",
        "sewing_contractors",
        "clients",
        "invites",
        "users",
    )
    # Child tables (no company_id) — drop rows whose parent rows we'd otherwise delete.
    # The parent CASCADEs handle this once the parent row is gone, so the explicit
    # deletes here are belt-and-suspenders for non-cascading FKs.
    await conn.execute(
        text(
            "DELETE FROM sewing_shipment_items WHERE shipment_id IN "
            "(SELECT id FROM sewing_shipments WHERE company_id = :cid)"
        ),
        {"cid": existing.id},
    )
    await conn.execute(
        text(
            "DELETE FROM cutting_order_outputs WHERE cutting_order_id IN "
            "(SELECT id FROM cutting_orders WHERE company_id = :cid)"
        ),
        {"cid": existing.id},
    )
    await conn.execute(
        text(
            "DELETE FROM print_order_outputs WHERE print_order_id IN "
            "(SELECT id FROM print_orders WHERE company_id = :cid)"
        ),
        {"cid": existing.id},
    )
    await conn.execute(
        text("DELETE FROM spec_trims WHERE spec_id IN (SELECT id FROM product_specs WHERE company_id = :cid)"),
        {"cid": existing.id},
    )
    for table in tenant_tables:
        await conn.execute(
            text(f"DELETE FROM {table} WHERE company_id = :cid"),
            {"cid": existing.id},
        )
    await conn.execute(text("DELETE FROM companies WHERE id = :cid"), {"cid": existing.id})
    await db.commit()


async def _seed_company(db: AsyncSession) -> Company:
    company = Company(**COMPANY)
    db.add(company)
    await db.flush()
    return company


async def _seed_users(db: AsyncSession, company: Company) -> dict[str, User]:
    role_rows = (await db.exec(select(Role))).all()
    roles_by_code = {r.code: r for r in role_rows}
    users: dict[str, User] = {}
    for spec in USERS:
        user = User(
            company_id=company.id,
            firebase_uid=spec["firebase_uid"],
            name=spec["name"],
            email=spec["email"],
            job=spec["job"],
            is_operator=spec["is_operator"],
            role_id=roles_by_code[spec["role_code"]].id,
        )
        db.add(user)
        users[spec["key"]] = user
    await db.flush()
    return users


async def _seed_clients(db: AsyncSession, company: Company) -> dict[str, Client]:
    out: dict[str, Client] = {}
    for spec in CLIENTS:
        client = Client(
            company_id=company.id,
            name=spec["name"],
            address=spec["address"],
            phone=spec["phone"],
            email=spec["email"],
        )
        db.add(client)
        out[spec["key"]] = client
    await db.flush()
    return out


async def _seed_print_designs(db: AsyncSession, company: Company) -> dict[str, PrintDesign]:
    out: dict[str, PrintDesign] = {}
    for spec in PRINT_DESIGNS:
        design = PrintDesign(
            company_id=company.id,
            code=spec["code"],
            name=spec["name"],
            cost_per_unit=spec["cost_per_unit"],
        )
        db.add(design)
        out[spec["key"]] = design
    await db.flush()
    return out


async def _seed_printing(db: AsyncSession, company: Company, prints: dict[str, PrintDesign]) -> None:
    """A DTF paper roll + one estampa variation + a pending print order (T4).

    Gives the Impressão board real data: an order with a planned front grade,
    ready for the operator to record printed counts and "Lançar impressos".
    """

    design = next(iter(prints.values()), None)
    if design is None:
        return

    # Ensure the chosen design is DTF + has a front so the order is valid.
    design.technique = PrintTechnique.DTF
    design.has_front = True
    db.add(design)

    variation = PrintDesignVariation(
        company_id=company.id,
        print_design_id=design.id,
        name="Preto",
        ink_hex="#1f1f1f",
    )
    db.add(variation)

    roll = PaperRoll(
        company_id=company.id,
        received_at=datetime.now(UTC).date(),
        supplier_name="DTF Brasil",
        paper_type=PaperType.DTF_FILM,
        width_cm=60,
        initial_meters=Decimal("100.00"),
        current_meters=Decimal("100.00"),
    )
    db.add(roll)
    await db.flush()

    order = PrintOrder(
        company_id=company.id,
        print_design_id=design.id,
        paper_roll_id=roll.id,
        status=PrintOrderStatus.PENDING,
    )
    db.add(order)
    await db.flush()

    db.add(
        PrintOrderOutput(
            print_order_id=order.id,
            print_design_variation_id=variation.id,
            side=PrintSide.FRONT,
            planned_quantity=12,
            printed_quantity=0,
        )
    )
    await db.flush()


async def _seed_specs(db: AsyncSession, company: Company) -> dict[str, ProductSpec]:
    out: dict[str, ProductSpec] = {}
    for spec in PRODUCT_SPECS:
        row = ProductSpec(
            company_id=company.id,
            code=spec["code"],
            name=spec["name"],
            fabric_type=spec["fabric_type"],
            fabric_grammage_gsm=spec["fabric_grammage_gsm"],
            fabric_weight_per_piece_g=spec["fabric_weight_per_piece_g"],
            has_ribana=spec["has_ribana"],
            ribana_weight_pct=spec["ribana_weight_pct"],
            labor_cost=spec["labor_cost"],
            sale_price=spec["sale_price"],
        )
        db.add(row)
        out[spec["key"]] = row
    await db.flush()
    return out


async def _seed_products(
    db: AsyncSession,
    company: Company,
    specs: dict[str, ProductSpec],
    prints: dict[str, PrintDesign],
) -> tuple[dict[str, Product], dict[tuple[str, str, str], ProductVariation]]:
    products: dict[str, Product] = {}
    variations: dict[tuple[str, str, str], ProductVariation] = {}
    for spec in PRODUCTS:
        product = Product(
            company_id=company.id,
            name=spec["name"],
            product_type=spec["product_type"],
            spec_id=specs[spec["spec_key"]].id,
            print_id=prints[spec["print_key"]].id if spec["print_key"] else None,
        )
        db.add(product)
        await db.flush()
        products[spec["key"]] = product
        ps_code = specs[spec["spec_key"]].code
        print_code = prints[spec["print_key"]].code if spec["print_key"] else None
        for var in spec["variations"]:
            sku = ProductVariation.make_sku(
                spec_code=ps_code,
                size=var["size"],
                color_code=var["color_code"],
                print_code=print_code,
            )
            variation = ProductVariation(
                company_id=company.id,
                product_id=product.id,
                size=var["size"],
                color=var["color"],
                color_code=var["color_code"],
                sku=sku,
            )
            db.add(variation)
            variations[(spec["key"], var["size"].value, var["color_code"])] = variation
    await db.flush()
    return products, variations


async def _seed_ads(db: AsyncSession, company: Company, products: dict[str, Product]) -> dict[str, Ad]:
    out: dict[str, Ad] = {}
    for spec in ADS:
        ad = Ad(
            company_id=company.id,
            title=spec["title"],
            ecommerce=spec["ecommerce"],
            external_id=spec["external_id"],
            product_id=products[spec["product_key"]].id,
        )
        db.add(ad)
        out[spec["key"]] = ad
    await db.flush()
    return out


async def _seed_fabric(db: AsyncSession, company: Company) -> dict[str, FabricRoll]:
    out: dict[str, FabricRoll] = {}
    for spec in FABRIC_ROLLS:
        roll = FabricRoll(
            company_id=company.id,
            received_at=spec["received_at"],
            supplier_name=spec["supplier_name"],
            kind=spec["kind"],
            fabric_type=spec["fabric_type"],
            initial_weight_kg=spec["initial_weight_kg"],
            current_weight_kg=spec["current_weight_kg"],
            color=spec["color"],
            price_per_kg=spec["price_per_kg"],
        )
        db.add(roll)
        out[spec["key"]] = roll
    await db.flush()
    return out


async def _seed_cutting(
    db: AsyncSession,
    company: Company,
    specs: dict[str, ProductSpec],
    rolls: dict[str, FabricRoll],
) -> dict[str, CuttingOrder]:
    out: dict[str, CuttingOrder] = {}
    for order_spec in CUTTING_ORDERS:
        order = CuttingOrder(
            company_id=company.id,
            spec_id=specs[order_spec["spec_key"]].id,
            color=order_spec["color"],
            color_code=order_spec["color_code"],
            body_roll_id=rolls[order_spec["body_roll_key"]].id,
            rib_roll_id=rolls[order_spec["rib_roll_key"]].id if order_spec["rib_roll_key"] else None,
            status=order_spec["status"],
            cut_at=order_spec["cut_at"],
        )
        db.add(order)
        await db.flush()
        out[order_spec["key"]] = order
        for output in order_spec["outputs"]:
            db.add(
                CuttingOrderOutput(
                    cutting_order_id=order.id,
                    size=output["size"],
                    quantity=output["quantity"],
                )
            )
    await db.flush()
    return out


async def _seed_contractors(db: AsyncSession, company: Company) -> dict[str, SewingContractor]:
    out: dict[str, SewingContractor] = {}
    for spec in SEWING_CONTRACTORS:
        contractor = SewingContractor(
            company_id=company.id,
            name=spec["name"],
            address=spec["address"],
            phone=spec["phone"],
        )
        db.add(contractor)
        out[spec["key"]] = contractor
    await db.flush()
    return out


async def _seed_shipments(
    db: AsyncSession,
    company: Company,
    cutting: dict[str, CuttingOrder],
    contractors: dict[str, SewingContractor],
) -> None:
    for spec in SEWING_SHIPMENTS:
        shipment = SewingShipment(
            company_id=company.id,
            cutting_order_id=cutting[spec["cutting_order_key"]].id,
            contractor_id=contractors[spec["contractor_key"]].id,
            sent_at=spec["sent_at"],
            received_at=spec["received_at"],
            status=spec["status"],
        )
        db.add(shipment)
        await db.flush()
        for item in spec["items"]:
            db.add(
                SewingShipmentItem(
                    shipment_id=shipment.id,
                    size=item["size"],
                    requested_quantity=item["requested_quantity"],
                    received_quantity=item["received_quantity"],
                )
            )
    await db.flush()


async def _seed_orders(
    db: AsyncSession,
    company: Company,
    ads: dict[str, Ad],
    clients: dict[str, Client],
    variations: dict[tuple[str, str, str], ProductVariation],
) -> None:
    for spec in ORDERS:
        product_key, size, color_code = spec["variation"]
        variation = variations[(product_key, size.value, color_code)]
        db.add(
            Order(
                company_id=company.id,
                ad_id=ads[spec["ad_key"]].id,
                variation_id=variation.id,
                client_id=clients[spec["client_key"]].id,
                quantity=spec["quantity"],
                sale_price=spec["sale_price"],
                ordered_at=spec["ordered_at"],
                status=spec["status"],
                external_order_id=spec["external_order_id"],
            )
        )
    await db.flush()


async def _seed_stock(
    db: AsyncSession,
    company: Company,
    variations: dict[tuple[str, str, str], ProductVariation],
) -> None:
    for spec in STOCK_ENTRIES:
        product_key, size, color_code = spec["variation"]
        variation = variations[(product_key, size.value, color_code)]
        db.add(
            StockEntry(
                company_id=company.id,
                variation_id=variation.id,
                quantity=spec["quantity"],
                source=spec["source"],
                notes=spec["notes"],
            )
        )
    await db.flush()


async def seed() -> uuid.UUID:
    factory = get_session_factory()
    async with factory() as db:
        await _wipe_existing_company(db, COMPANY["subdomain"])
        company = await _seed_company(db)
        await _seed_users(db, company)
        clients = await _seed_clients(db, company)
        prints = await _seed_print_designs(db, company)
        await _seed_printing(db, company, prints)
        specs = await _seed_specs(db, company)
        products, variations = await _seed_products(db, company, specs, prints)
        ads = await _seed_ads(db, company, products)
        rolls = await _seed_fabric(db, company)
        cutting = await _seed_cutting(db, company, specs, rolls)
        contractors = await _seed_contractors(db, company)
        await _seed_shipments(db, company, cutting, contractors)
        await _seed_orders(db, company, ads, clients, variations)
        await _seed_stock(db, company, variations)
        await db.commit()
        return company.id


def main() -> None:
    company_id = asyncio.run(seed())
    print(f"Seeded company {COMPANY['subdomain']} ({company_id})")


if __name__ == "__main__":
    main()
