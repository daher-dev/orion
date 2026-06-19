"""Dashboard Top-5 products ranking (by pieces in the order book)."""

from models import OrderStatus, Size
from services.dashboard import get_summary
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_product,
    create_product_spec,
    create_product_variation,
)
from tests.factories import (
    create_order as factory_create_order,
)


async def _product(db_session, company_id, *, code, name):
    spec = await create_product_spec(db_session, company_id=company_id, code=code)
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id, name=name)
    variation = await create_product_variation(
        db_session, company_id=company_id, product_id=product.id, size=Size.M, color="Preto", color_code="BLK"
    )
    ad = await create_ad(db_session, company_id=company_id, product_id=product.id)
    return product, variation, ad


async def _order(db_session, company_id, client_id, variation, ad, *, quantity, ext, status=OrderStatus.PAID):
    return await factory_create_order(
        db_session,
        company_id=company_id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client_id,
        quantity=quantity,
        status=status,
        external_order_id=ext,
    )


async def test_top_products_ranked_by_pieces(db_session):
    company = await create_company(db_session)
    client = await create_client(db_session, company_id=company.id)

    # P1: 2 orders (5 + 3) = 8 pieces.
    _, v1, ad1 = await _product(db_session, company.id, code="2055", name="Camiseta 2055")
    await _order(db_session, company.id, client.id, v1, ad1, quantity=5, ext="P1A")
    await _order(db_session, company.id, client.id, v1, ad1, quantity=3, ext="P1B")
    # P2: 1 order, 4 pieces.
    _, v2, ad2 = await _product(db_session, company.id, code="2047", name="Camiseta 2047")
    await _order(db_session, company.id, client.id, v2, ad2, quantity=4, ext="P2A")
    # A cancelled P2 order must not inflate the ranking.
    await _order(db_session, company.id, client.id, v2, ad2, quantity=99, ext="P2X", status=OrderStatus.CANCELLED)

    tp = (await get_summary(db_session, company_id=company.id)).top_products
    assert [t.code for t in tp] == ["2055", "2047"]
    assert tp[0].name == "Camiseta 2055"
    assert tp[0].pieces == 8
    assert tp[0].orders == 2
    assert tp[1].pieces == 4
    assert tp[1].orders == 1


async def test_top_products_limited_to_five(db_session):
    company = await create_company(db_session)
    client = await create_client(db_session, company_id=company.id)
    # Six products, each with one order of increasing quantity (1..6).
    for i in range(6):
        _, v, ad = await _product(db_session, company.id, code=f"C{i:03d}", name=f"Prod {i}")
        await _order(db_session, company.id, client.id, v, ad, quantity=i + 1, ext=f"O{i}")

    tp = (await get_summary(db_session, company_id=company.id)).top_products
    assert len(tp) == 5
    # Highest pieces first; the smallest (quantity 1) drops off.
    assert tp[0].pieces == 6
    assert [t.pieces for t in tp] == [6, 5, 4, 3, 2]


async def test_top_products_tenant_isolation(db_session):
    company = await create_company(db_session)
    client = await create_client(db_session, company_id=company.id)
    _, v, ad = await _product(db_session, company.id, code="2055", name="Camiseta 2055")
    await _order(db_session, company.id, client.id, v, ad, quantity=7, ext="A1")

    other = await create_company(db_session)
    other_client = await create_client(db_session, company_id=other.id)
    _, ov, oad = await _product(db_session, other.id, code="9999", name="Outro")
    await _order(db_session, other.id, other_client.id, ov, oad, quantity=99, ext="X1")

    tp = (await get_summary(db_session, company_id=company.id)).top_products
    assert [t.code for t in tp] == ["2055"]
    assert tp[0].pieces == 7
