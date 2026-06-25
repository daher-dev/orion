"""Dashboard Top-5 ranking — by mapped *estampa* (design), Base44-style.

The ranking groups orders by the print design name (``estampa_mapeada``),
falling back to the ad title for no-print orders, and carries the design
artwork as a thumbnail. ``orders`` counts distinct marketplace orders.
"""

from datetime import UTC, datetime, timedelta

from models import OrderStatus, Size
from services.dashboard import get_summary
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_print_design,
    create_product,
    create_product_spec,
    create_product_variation,
)
from tests.factories import (
    create_order as factory_create_order,
)


async def _design_product(db_session, company_id, *, design_name, image_url=None, ad_title="Anúncio"):
    """A product wired to a print design (estampa) + an ad, ready for orders."""
    spec = await create_product_spec(db_session, company_id=company_id)
    design = await create_print_design(db_session, company_id=company_id, name=design_name, image_url=image_url)
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id, print_id=design.id)
    variation = await create_product_variation(db_session, company_id=company_id, product_id=product.id, size=Size.M)
    ad = await create_ad(db_session, company_id=company_id, product_id=product.id, title=ad_title)
    return variation, ad


async def _order(
    db_session, company_id, client_id, variation, ad, *, quantity, ext, status=OrderStatus.PAID, ordered_at=None
):
    overrides = {"ordered_at": ordered_at} if ordered_at is not None else {}
    return await factory_create_order(
        db_session,
        company_id=company_id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client_id,
        quantity=quantity,
        status=status,
        external_order_id=ext,
        **overrides,
    )


async def test_top_products_ranked_by_design(db_session):
    company = await create_company(db_session)
    client = await create_client(db_session, company_id=company.id)

    # Design "2055" (with artwork): 2 orders (5 + 3) = 8 pieces, 2 distinct orders.
    v1, ad1 = await _design_product(db_session, company.id, design_name="2055", image_url="https://cdn.test/2055.png")
    await _order(db_session, company.id, client.id, v1, ad1, quantity=5, ext="P1A")
    await _order(db_session, company.id, client.id, v1, ad1, quantity=3, ext="P1B")
    # Design "Punisher" (no artwork): 1 order, 4 pieces.
    v2, ad2 = await _design_product(db_session, company.id, design_name="Punisher")
    await _order(db_session, company.id, client.id, v2, ad2, quantity=4, ext="P2A")
    # A cancelled order must not inflate the ranking.
    await _order(db_session, company.id, client.id, v2, ad2, quantity=99, ext="P2X", status=OrderStatus.CANCELLED)

    tp = (await get_summary(db_session, company_id=company.id)).top_products
    assert [t.name for t in tp] == ["2055", "Punisher"]
    assert tp[0].pieces == 8
    assert tp[0].orders == 2
    assert tp[0].image_url == "https://cdn.test/2055.png"
    assert tp[1].pieces == 4
    assert tp[1].orders == 1
    assert tp[1].image_url is None


async def test_top_products_groups_same_design_across_products(db_session):
    """Two distinct products sharing a design name collapse into one row."""
    company = await create_company(db_session)
    client = await create_client(db_session, company_id=company.id)
    v1, ad1 = await _design_product(db_session, company.id, design_name="Shared")
    v2, ad2 = await _design_product(db_session, company.id, design_name="Shared")
    await _order(db_session, company.id, client.id, v1, ad1, quantity=2, ext="S1")
    await _order(db_session, company.id, client.id, v2, ad2, quantity=3, ext="S2")

    tp = (await get_summary(db_session, company_id=company.id)).top_products
    assert len(tp) == 1
    assert tp[0].name == "Shared"
    assert tp[0].pieces == 5
    assert tp[0].orders == 2


async def test_top_products_fallback_to_ad_title_when_no_design(db_session):
    """Orders on a no-print product group under the ad title (estampa || titulo)."""
    company = await create_company(db_session)
    client = await create_client(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)  # print_id=None
    variation = await create_product_variation(db_session, company_id=company.id, product_id=product.id, size=Size.M)
    ad = await create_ad(db_session, company_id=company.id, product_id=product.id, title="Camiseta Lisa")
    await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        quantity=6,
        status=OrderStatus.PAID,
        external_order_id="N1",
    )

    tp = (await get_summary(db_session, company_id=company.id)).top_products
    assert [t.name for t in tp] == ["Camiseta Lisa"]
    assert tp[0].pieces == 6


async def test_top_products_limited_to_five(db_session):
    company = await create_company(db_session)
    client = await create_client(db_session, company_id=company.id)
    # Six designs, each with one order of increasing quantity (1..6).
    for i in range(6):
        v, ad = await _design_product(db_session, company.id, design_name=f"D{i}")
        await _order(db_session, company.id, client.id, v, ad, quantity=i + 1, ext=f"O{i}")

    tp = (await get_summary(db_session, company_id=company.id)).top_products
    assert len(tp) == 5
    # Highest pieces first; the smallest (quantity 1) drops off.
    assert [t.pieces for t in tp] == [6, 5, 4, 3, 2]


async def test_top_products_tenant_isolation(db_session):
    company = await create_company(db_session)
    client = await create_client(db_session, company_id=company.id)
    v, ad = await _design_product(db_session, company.id, design_name="2055")
    await _order(db_session, company.id, client.id, v, ad, quantity=7, ext="A1")

    other = await create_company(db_session)
    other_client = await create_client(db_session, company_id=other.id)
    ov, oad = await _design_product(db_session, other.id, design_name="Outro")
    await _order(db_session, other.id, other_client.id, ov, oad, quantity=99, ext="X1")

    tp = (await get_summary(db_session, company_id=company.id)).top_products
    assert [t.name for t in tp] == ["2055"]
    assert tp[0].pieces == 7


async def test_top_products_respects_since_window(db_session):
    """The date-range filter scopes the ranking to ``ordered_at >= since``."""
    company = await create_company(db_session)
    client = await create_client(db_session, company_id=company.id)
    v, ad = await _design_product(db_session, company.id, design_name="Recent")
    now = datetime.now(UTC)
    await _order(db_session, company.id, client.id, v, ad, quantity=5, ext="R1", ordered_at=now)
    await _order(db_session, company.id, client.id, v, ad, quantity=8, ext="OLD", ordered_at=now - timedelta(days=40))

    # All history → both orders (13 pieces).
    tp_all = (await get_summary(db_session, company_id=company.id)).top_products
    assert tp_all[0].pieces == 13
    assert tp_all[0].orders == 2

    # Last 7 days → only the recent order (5 pieces).
    tp_win = (await get_summary(db_session, company_id=company.id, since=now - timedelta(days=7))).top_products
    assert tp_win[0].pieces == 5
    assert tp_win[0].orders == 1
