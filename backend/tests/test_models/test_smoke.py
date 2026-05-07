"""End-to-end smoke test exercising the full domain model.

Walks one happy-path slice through the data model: company + user, catalog,
fabric, cutting → sewing → stock → sale. Asserts the SKU format and the
stock-on-hand math.
"""

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    Ad,
    Client,
    Company,
    CuttingOrder,
    CuttingOrderOutput,
    CuttingStatus,
    Ecommerce,
    FabricRoll,
    FabricRollKind,
    FabricType,
    Order,
    OrderStatus,
    PrintDesign,
    Product,
    ProductSpec,
    ProductType,
    ProductVariation,
    Role,
    SewingContractor,
    SewingShipment,
    SewingShipmentItem,
    ShipmentStatus,
    Size,
    SpecTrim,
    StockEntry,
    StockExit,
    StockExitReason,
    StockSource,
    TrimType,
    User,
)


@pytest.fixture
async def admin_role(db_session: AsyncSession) -> Role:
    """The seed migration inserts admin/manager/operator. Look up admin."""
    result = await db_session.exec(select(Role).where(Role.code == "admin"))
    return result.one()


async def test_full_domain_smoke(db_session: AsyncSession, admin_role: Role) -> None:
    # Company + user
    company = Company(name="Acme Têxtil", subdomain="acme", main_color="#FF6600")
    db_session.add(company)
    await db_session.flush()

    user = User(
        company_id=company.id,
        firebase_uid="firebase-abc-123",
        name="Joao",
        email="joao@acme.example",
        job="Owner",
        role_id=admin_role.id,
    )
    db_session.add(user)
    await db_session.flush()
    assert user.id is not None
    assert user.is_operator is False

    # Catalog: spec + trims, print, product, variation
    spec = ProductSpec(
        company_id=company.id,
        code="CAM01",
        name="Camiseta básica",
        fabric_type=FabricType.JERSEY,
        fabric_grammage_gsm=160,
        fabric_weight_per_piece_g=Decimal("180.00"),
        has_ribana=True,
        ribana_weight_pct=Decimal("8.50"),
        labor_cost=Decimal("12.00"),
        sale_price=Decimal("79.90"),
    )
    db_session.add(spec)
    await db_session.flush()

    db_session.add(
        SpecTrim(
            spec_id=spec.id,
            trim_type=TrimType.LABEL,
            unit_price=Decimal("0.50"),
            quantity=2,
        )
    )

    print_design = PrintDesign(
        company_id=company.id,
        code="FLR03",
        name="Floral 03",
        cost_per_unit=Decimal("4.20"),
    )
    db_session.add(print_design)
    await db_session.flush()

    product = Product(
        company_id=company.id,
        name="Camiseta Floral 03",
        product_type=ProductType.TSHIRT,
        spec_id=spec.id,
        print_id=print_design.id,
    )
    db_session.add(product)
    await db_session.flush()

    sku = ProductVariation.make_sku(spec.code, Size.M, "BLK", print_design.code)
    assert sku == "CAM01-M-BLK-FLR03"

    variation = ProductVariation(
        company_id=company.id,
        product_id=product.id,
        size=Size.M,
        color="Preto",
        color_code="BLK",
        sku=sku,
    )
    db_session.add(variation)
    await db_session.flush()

    ad = Ad(
        company_id=company.id,
        title="Camiseta Floral 03 - Preto",
        ecommerce=Ecommerce.SHOPEE,
        product_id=product.id,
    )
    client = Client(company_id=company.id, name="Maria Cliente")
    contractor = SewingContractor(company_id=company.id, name="Banca da Dona Joana")
    db_session.add_all([ad, client, contractor])
    await db_session.flush()

    # Raw production: fabric rolls + cutting order
    body_roll = FabricRoll(
        company_id=company.id,
        received_at=date(2026, 4, 1),
        supplier_name="Tecidos SP",
        kind=FabricRollKind.BODY,
        fabric_type=FabricType.JERSEY,
        initial_weight_kg=Decimal("25.000"),
        current_weight_kg=Decimal("25.000"),
        color="Preto",
        price_per_kg=Decimal("38.00"),
    )
    rib_roll = FabricRoll(
        company_id=company.id,
        received_at=date(2026, 4, 1),
        supplier_name="Tecidos SP",
        kind=FabricRollKind.RIB,
        fabric_type=FabricType.RIB,
        initial_weight_kg=Decimal("3.000"),
        current_weight_kg=Decimal("3.000"),
        color="Preto",
        price_per_kg=Decimal("42.00"),
    )
    db_session.add_all([body_roll, rib_roll])
    await db_session.flush()

    cutting_order = CuttingOrder(
        company_id=company.id,
        product_id=product.id,
        body_roll_id=body_roll.id,
        rib_roll_id=rib_roll.id,
        status=CuttingStatus.DONE,
        cut_at=datetime(2026, 4, 5, 10, 0, tzinfo=UTC),
    )
    db_session.add(cutting_order)
    await db_session.flush()

    db_session.add_all(
        [
            CuttingOrderOutput(cutting_order_id=cutting_order.id, size=Size.M, quantity=20),
            CuttingOrderOutput(cutting_order_id=cutting_order.id, size=Size.G, quantity=15),
        ]
    )

    # Sewing shipment with partial fulfillment
    shipment = SewingShipment(
        company_id=company.id,
        cutting_order_id=cutting_order.id,
        contractor_id=contractor.id,
        sent_at=date(2026, 4, 6),
        received_at=date(2026, 4, 18),
        status=ShipmentStatus.PARTIAL,
    )
    db_session.add(shipment)
    await db_session.flush()

    db_session.add_all(
        [
            SewingShipmentItem(
                shipment_id=shipment.id,
                size=Size.M,
                requested_quantity=20,
                received_quantity=18,
            ),
            SewingShipmentItem(
                shipment_id=shipment.id,
                size=Size.G,
                requested_quantity=15,
                received_quantity=15,
            ),
        ]
    )

    # Stock entry for the M variation we created
    db_session.add(
        StockEntry(
            company_id=company.id,
            variation_id=variation.id,
            shipment_id=shipment.id,
            quantity=18,
            source=StockSource.SHIPMENT,
        )
    )

    # Sale
    order = Order(
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        quantity=2,
        sale_price=Decimal("79.90"),
        ordered_at=datetime(2026, 4, 20, 14, 0, tzinfo=UTC),
        status=OrderStatus.PAID,
        external_order_id="SHP-12345",
    )
    db_session.add(order)
    await db_session.flush()

    db_session.add(
        StockExit(
            company_id=company.id,
            variation_id=variation.id,
            order_id=order.id,
            quantity=2,
            reason=StockExitReason.SALE,
        )
    )
    await db_session.commit()

    # Stock-on-hand math: entries - exits per variation.
    entries = await db_session.exec(
        select(func.coalesce(func.sum(StockEntry.quantity), 0)).where(StockEntry.variation_id == variation.id)
    )
    exits = await db_session.exec(
        select(func.coalesce(func.sum(StockExit.quantity), 0)).where(StockExit.variation_id == variation.id)
    )
    on_hand = int(entries.one()) - int(exits.one())
    assert on_hand == 16


async def test_sku_make_sku_with_print() -> None:
    assert ProductVariation.make_sku("CAM01", Size.GG, "wht", "FLR03") == "CAM01-GG-WHT-FLR03"


async def test_sku_make_sku_without_print() -> None:
    """Products without an estampa stop at the color segment."""
    assert ProductVariation.make_sku("BER02", Size.M, "blk") == "BER02-M-BLK"
    assert ProductVariation.make_sku("BER02", Size.M, "blk", None) == "BER02-M-BLK"


async def test_product_can_have_no_print(db_session: AsyncSession) -> None:
    """Plain (no-print) product flow: create spec → product without print_id →
    variation whose SKU has no print suffix."""
    company = Company(name="Acme Plain", subdomain="acme-plain", main_color="#112233")
    db_session.add(company)
    await db_session.flush()

    spec = ProductSpec(
        company_id=company.id,
        code="BER02",
        name="Bermuda lisa",
        fabric_type=FabricType.FRENCH_TERRY,
        fabric_grammage_gsm=240,
        fabric_weight_per_piece_g=Decimal("260.00"),
        has_ribana=False,
        labor_cost=Decimal("9.00"),
        sale_price=Decimal("89.90"),
    )
    db_session.add(spec)
    await db_session.flush()

    product = Product(
        company_id=company.id,
        name="Bermuda lisa preta",
        product_type=ProductType.SHORTS,
        spec_id=spec.id,
        print_id=None,
    )
    db_session.add(product)
    await db_session.flush()
    assert product.print_id is None

    sku = ProductVariation.make_sku(spec.code, Size.M, "BLK")
    assert sku == "BER02-M-BLK"

    variation = ProductVariation(
        company_id=company.id,
        product_id=product.id,
        size=Size.M,
        color="Preto",
        color_code="BLK",
        sku=sku,
    )
    db_session.add(variation)
    await db_session.commit()
    assert variation.id is not None


async def test_seeded_roles_present(db_session: AsyncSession) -> None:
    result = await db_session.exec(select(Role.code).order_by(Role.code))
    assert list(result.all()) == ["admin", "manager", "operator"]
