"""Service tests for the Upseller marketplace order import."""

import uuid

from sqlmodel import select

from models import Ecommerce, ImportedOrder, Order, OrderStatus, Size
from services.imported_orders import (
    _extract_color_size,
    _parse_marketplace,
    _variation_tokens,
    import_upseller_orders,
    parse_upseller_csv,
)
from services.sku_mapping import upsert_mapping
from tests.factories import (
    create_ad,
    create_company,
    create_product,
    create_product_spec,
    create_product_variation,
    create_user,
)

# Exact header line from the real Upseller export (accented, ;-delimited).
HEADER = (
    "Nº de Pedido da Plataforma;Nº de Pedido;Plataformas;Nome da Loja no UpSeller;"
    "Nome do Anúncio;SKU;Variação;Link da Imagem;Qtd. do Produto;Unidade*;"
    "Nº de Rastreio;Etiqueta;Chave da Nota Fiscal"
)


def _row(
    *,
    platform_order_id="260518Q88KUF31",
    upseller="UPTHK246656",
    marketplace="Shopee",
    store="Shopee Underground",
    ad_title="Short 2 em 1 Muay Thai",
    sku="18398298341-0391-AZUL-G",
    variacao="0391-AZUL,G",
    image="https://cf.shopee.com.br/file/img_tn",
    qty="1",
    unit="UN - Unidade",
    tracking="BR2699283158831",
    label="https://print-label.upseller.cn/pdf-cache/2026-05-18/27187/abc.pdf",
    nfe="35260544031336000197550090001016751345126228",
):
    return ";".join(
        [
            platform_order_id,
            upseller,
            marketplace,
            store,
            ad_title,
            sku,
            variacao,
            image,
            qty,
            unit,
            tracking,
            label,
            nfe,
        ]
    )


def _csv_bytes(*rows: str) -> bytes:
    """Build a Windows-1252-encoded, ;-delimited CSV like the real export."""

    return ("\r\n".join([HEADER, *rows]) + "\r\n").encode("cp1252")


async def _seed_match(
    db,
    company_id: uuid.UUID,
    *,
    ad_title="Short 2 em 1 Muay Thai",
    external_id="18398298341",
    ecommerce=None,
    size=Size.G,
    color="Azul",
    color_code="AZU",
):
    """Seed a catalog chain a default _row() will strict-match against."""

    from models import Ecommerce

    spec = await create_product_spec(db, company_id=company_id)
    product = await create_product(db, company_id=company_id, spec_id=spec.id)
    variation = await create_product_variation(
        db, company_id=company_id, product_id=product.id, size=size, color=color, color_code=color_code
    )
    ad = await create_ad(
        db,
        company_id=company_id,
        product_id=product.id,
        title=ad_title,
        external_id=external_id,
        ecommerce=ecommerce or Ecommerce.SHOPEE,
    )
    return spec, product, variation, ad


# --------------------------------------------------------------- pure parsing


def test_extract_color_size_handles_per_channel_formats():
    assert _extract_color_size("0391-AZUL,G") == ("0391-AZUL", "G")  # Shopee/TikTok
    assert _extract_color_size("P,Preto,Eis Me Aqui") == ("Preto", "P")  # Mercado Livre
    assert _extract_color_size("Preto-G") == ("Preto-G", None)  # Shein (no separator)
    assert _extract_color_size("") == (None, None)


def test_parse_marketplace_folds_labels_to_enum():
    assert _parse_marketplace("Shopee") == Ecommerce.SHOPEE
    assert _parse_marketplace("Mercado Libre") == Ecommerce.MERCADO_LIVRE  # Spanish
    assert _parse_marketplace("Mercado Livre") == Ecommerce.MERCADO_LIVRE
    assert _parse_marketplace("Shein") == Ecommerce.SHEIN
    assert _parse_marketplace("TikTok Shop") == Ecommerce.TIKTOK_SHOP
    assert _parse_marketplace("Some Random Channel") == Ecommerce.OTHER
    assert _parse_marketplace("") == Ecommerce.OTHER


def test_variation_tokens_are_order_insensitive():
    # The marketplace shuffles the tokens (and slips a print name among them);
    # the extracted size + colour token bag is identical regardless of order.
    assert _variation_tokens("Bege,NY,M") == (Size.M, {"bege", "ny"})
    assert _variation_tokens("NY,Bege,M") == (Size.M, {"bege", "ny"})
    assert _variation_tokens("M,NY,Bege") == (Size.M, {"bege", "ny"})
    assert _variation_tokens("Preto,Naruto 03,GG") == (Size.GG, {"preto", "naruto03"})
    # "Único" folds to the single Size.U member.
    assert _variation_tokens("Preto,Único")[0] == Size.U


def test_parse_decodes_cp1252_and_maps_headers():
    csv = _csv_bytes(
        _row(),
        _row(
            marketplace="Mercado Libre",
            ad_title="Camisa Proteção UV",
            sku="189013829635",
            variacao="P,Preto,Eis Me Aqui",
            label="https://print-label.upseller.cn/pdf-cache/2026-05-19/27187/x.pdf",
        ),
    )
    rows = parse_upseller_csv(csv)
    assert len(rows) == 2

    first = rows[0]
    assert first.marketplace == "Shopee"
    assert first.platform_order_id == "260518Q88KUF31"
    assert first.upseller_order_no == "UPTHK246656"
    assert first.ad_title == "Short 2 em 1 Muay Thai"
    assert first.sku == "18398298341-0391-AZUL-G"
    assert first.color == "0391-AZUL"
    assert first.size == "G"
    assert first.quantity == 1
    assert first.tracking_code == "BR2699283158831"
    assert first.shipping_label_url.endswith("abc.pdf")
    assert first.invoice_key == "35260544031336000197550090001016751345126228"

    # Accented content round-trips through the cp1252 decode.
    assert rows[1].ad_title == "Camisa Proteção UV"
    assert rows[1].color == "Preto"
    assert rows[1].size == "P"


def test_parse_rejects_non_upseller_csv():
    import pytest

    from shared.exceptions import ValidationError

    bad = b"name,email,total\nAcme,a@b.com,10\n"
    with pytest.raises(ValidationError):
        parse_upseller_csv(bad)


# ------------------------------------------------------------------- import


async def _company_user(db):
    company = await create_company(db)
    user = await create_user(db, company_id=company.id, firebase_uid=f"u-{uuid.uuid4().hex[:8]}")
    return company, user


async def test_import_strict_match_creates_order_and_imported_order(db_session):
    company, user = await _company_user(db_session)
    _, _, variation, ad = await _seed_match(db_session, company.id)

    summary = await import_upseller_orders(
        db_session, company_id=company.id, user_id=user.id, file_bytes=_csv_bytes(_row())
    )

    assert summary.created == 1
    assert summary.errors == []
    assert summary.skipped_duplicates == 0

    order = (await db_session.exec(select(Order).where(Order.company_id == company.id))).one()
    assert order.ad_id == ad.id
    assert order.variation_id == variation.id
    assert order.client_id is None
    assert order.sale_price is None
    assert order.status == OrderStatus.PENDING
    assert order.external_order_id == "260518Q88KUF31"
    # ordered_at derived from the shipping-label URL date.
    assert (order.ordered_at.year, order.ordered_at.month, order.ordered_at.day) == (2026, 5, 18)

    imported = (await db_session.exec(select(ImportedOrder).where(ImportedOrder.order_id == order.id))).one()
    assert imported.marketplace == Ecommerce.SHOPEE
    assert imported.upseller_order_no == "UPTHK246656"
    assert imported.tracking_code == "BR2699283158831"
    assert imported.invoice_key == "35260544031336000197550090001016751345126228"
    assert imported.shipping_label_url.endswith("abc.pdf")


async def test_import_unmatched_ad_is_error_not_persisted(db_session):
    company, user = await _company_user(db_session)
    company_id = company.id  # capture before import (its rollback expires ORM objects)
    # Catalog exists but the ad's listing id / title do not match the row.
    await _seed_match(db_session, company_id, ad_title="Totally Different", external_id="999")

    summary = await import_upseller_orders(
        db_session, company_id=company_id, user_id=user.id, file_bytes=_csv_bytes(_row())
    )

    assert summary.created == 0
    assert len(summary.errors) == 1
    assert "ad" in summary.errors[0].message.lower()
    assert (await db_session.exec(select(Order).where(Order.company_id == company_id))).all() == []


async def test_import_unmatched_variation_is_error(db_session):
    company, user = await _company_user(db_session)
    # Ad matches (same external id) but the only variation is size M, not G.
    await _seed_match(db_session, company.id, size=Size.M, color="Preto", color_code="BLK")

    summary = await import_upseller_orders(
        db_session, company_id=company.id, user_id=user.id, file_bytes=_csv_bytes(_row())
    )

    assert summary.created == 0
    assert len(summary.errors) == 1
    assert "variation" in summary.errors[0].message.lower()


async def test_import_ambiguous_variation_is_error(db_session):
    company, user = await _company_user(db_session)
    from models import Ecommerce

    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    # Two size-G variations; a row with no colour token can't disambiguate.
    await create_product_variation(
        db_session, company_id=company.id, product_id=product.id, size=Size.G, color="Azul", color_code="AZU"
    )
    await create_product_variation(
        db_session, company_id=company.id, product_id=product.id, size=Size.G, color="Verde", color_code="GRN"
    )
    await create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        title="X",
        external_id="55",
        ecommerce=Ecommerce.SHOPEE,
    )

    summary = await import_upseller_orders(
        db_session,
        company_id=company.id,
        user_id=user.id,
        file_bytes=_csv_bytes(_row(sku="55-1", variacao="G")),
    )

    assert summary.created == 0
    assert len(summary.errors) == 1
    assert "ambiguous" in summary.errors[0].message.lower()


async def test_import_is_idempotent_on_reimport(db_session):
    company, user = await _company_user(db_session)
    company_id = company.id  # capture before import (its rollback expires ORM objects)
    await _seed_match(db_session, company_id)
    csv = _csv_bytes(_row())

    first = await import_upseller_orders(db_session, company_id=company_id, user_id=user.id, file_bytes=csv)
    second = await import_upseller_orders(db_session, company_id=company_id, user_id=user.id, file_bytes=csv)

    assert first.created == 1
    assert second.created == 0
    assert second.skipped_duplicates == 1
    orders = (await db_session.exec(select(Order).where(Order.company_id == company_id))).all()
    assert len(orders) == 1


async def test_import_multiline_same_order_different_variation_both_persist(db_session):
    """Two line items of one platform order (widened unique index allows it)."""

    company, user = await _company_user(db_session)
    from models import Ecommerce

    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    await create_product_variation(
        db_session, company_id=company.id, product_id=product.id, size=Size.G, color="Azul", color_code="AZU"
    )
    await create_product_variation(
        db_session, company_id=company.id, product_id=product.id, size=Size.M, color="Verde", color_code="GRN"
    )
    await create_ad(
        db_session,
        company_id=company.id,
        product_id=product.id,
        title="Multi",
        external_id="700",
        ecommerce=Ecommerce.SHOPEE,
    )

    csv = _csv_bytes(
        _row(platform_order_id="SAME1", sku="700-azul-g", variacao="Azul,G"),
        _row(platform_order_id="SAME1", sku="700-verde-m", variacao="Verde,M"),
    )
    summary = await import_upseller_orders(db_session, company_id=company.id, user_id=user.id, file_bytes=csv)

    assert summary.created == 2
    assert summary.errors == []
    orders = (await db_session.exec(select(Order).where(Order.external_order_id == "SAME1"))).all()
    assert len(orders) == 2


async def test_dry_run_does_not_persist(db_session):
    company, user = await _company_user(db_session)
    await _seed_match(db_session, company.id)

    summary = await import_upseller_orders(
        db_session, company_id=company.id, user_id=user.id, file_bytes=_csv_bytes(_row()), dry_run=True
    )

    assert summary.created == 1
    assert summary.dry_run is True
    assert (await db_session.exec(select(Order).where(Order.company_id == company.id))).all() == []
    assert (await db_session.exec(select(ImportedOrder))).all() == []


async def test_import_matches_variation_despite_shuffled_tokens(db_session):
    """Size-first / colour-first / print-name-in-the-middle all resolve alike."""

    company, user = await _company_user(db_session)
    # SKU won't sku-match the catalog variation, so the colour/size token path runs.
    _, _, variation, _ = await _seed_match(db_session, company.id, size=Size.G, color="Azul", color_code="AZU")

    for variacao in ("G,Azul", "Azul,G", "Azul,Estampa Legal,G"):
        csv = _csv_bytes(_row(platform_order_id=f"ORD-{variacao}", sku="ZZZ", variacao=variacao))
        summary = await import_upseller_orders(db_session, company_id=company.id, user_id=user.id, file_bytes=csv)
        assert summary.errors == [], variacao
        assert summary.created == 1, variacao

    orders = (await db_session.exec(select(Order).where(Order.company_id == company.id))).all()
    assert len(orders) == 3
    assert {o.variation_id for o in orders} == {variation.id}


async def test_import_resolves_via_sku_mapping_when_fuzzy_fails(db_session):
    company, user = await _company_user(db_session)
    company_id = company.id
    # Catalog exists but neither the ad's listing id nor its title match the row,
    # so fuzzy resolution would drop the line as an error.
    _, _, variation, ad = await _seed_match(db_session, company_id, ad_title="Totally Different", external_id="999")

    # Without a mapping the line is unmatched.
    csv = _csv_bytes(_row())
    dry = await import_upseller_orders(db_session, company_id=company_id, user_id=user.id, file_bytes=csv, dry_run=True)
    assert dry.created == 0
    assert len(dry.errors) == 1

    # Operator pins the marketplace SKU → ad + variation (the De/Para).
    await upsert_mapping(
        db_session,
        company_id=company_id,
        user_id=user.id,
        marketplace=Ecommerce.SHOPEE,
        sku="18398298341-0391-AZUL-G",
        ad_id=ad.id,
        variation_id=variation.id,
    )

    # Same file now resolves deterministically via the mapping.
    summary = await import_upseller_orders(db_session, company_id=company_id, user_id=user.id, file_bytes=csv)
    assert summary.errors == []
    assert summary.created == 1
    order = (await db_session.exec(select(Order).where(Order.company_id == company_id))).one()
    assert order.ad_id == ad.id
    assert order.variation_id == variation.id


async def test_unmatched_error_carries_resolver_context(db_session):
    company, user = await _company_user(db_session)
    company_id = company.id
    await _seed_match(db_session, company_id, ad_title="Totally Different", external_id="999")

    summary = await import_upseller_orders(
        db_session, company_id=company_id, user_id=user.id, file_bytes=_csv_bytes(_row()), dry_run=True
    )

    assert len(summary.errors) == 1
    err = summary.errors[0]
    # The resolver needs the channel, SKU, ad title, variation text and image.
    assert err.marketplace == Ecommerce.SHOPEE
    assert err.sku == "18398298341-0391-AZUL-G"
    assert err.ad_title == "Short 2 em 1 Muay Thai"
    assert err.variation_text == "0391-AZUL,G"
    assert err.image_url is not None
