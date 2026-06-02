"""Router tests for POST /v1/orders/import/upseller."""

import uuid

from httpx import AsyncClient

from models import Ecommerce, Size
from tests.factories import (
    create_ad,
    create_company,
    create_product,
    create_product_spec,
    create_product_variation,
    create_user,
    get_role_by_code,
)

HEADER = (
    "Nº de Pedido da Plataforma;Nº de Pedido;Plataformas;Nome da Loja no UpSeller;"
    "Nome do Anúncio;SKU;Variação;Link da Imagem;Qtd. do Produto;Unidade*;"
    "Nº de Rastreio;Etiqueta;Chave da Nota Fiscal"
)


def _row(
    *,
    platform_order_id="260518Q88KUF31",
    sku="18398298341-0391-AZUL-G",
    variacao="0391-AZUL,G",
    ad_title="Short 2 em 1 Muay Thai",
):
    return ";".join(
        [
            platform_order_id,
            "UPTHK246656",
            "Shopee",
            "Shopee Underground",
            ad_title,
            sku,
            variacao,
            "https://cf.shopee.com.br/file/img_tn",
            "1",
            "UN - Unidade",
            "BR2699283158831",
            "https://print-label.upseller.cn/pdf-cache/2026-05-18/27187/abc.pdf",
            "35260544031336000197550090001016751345126228",
        ]
    )


def _csv_bytes(*rows: str) -> bytes:
    return ("\r\n".join([HEADER, *rows]) + "\r\n").encode("cp1252")


def _upload(csv: bytes, *, dry_run: bool = False) -> dict:
    return {
        "files": {"file": ("checkout.csv", csv, "text/csv")},
        "data": {"dry_run": "true" if dry_run else "false"},
    }


async def _provision_manager(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid=firebase_uid)
    return company, user


async def _provision_operator(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(db_session, company_id=company.id, role_id=operator_role.id, firebase_uid=firebase_uid)
    return company, user


async def _seed_match(db_session, company_id: uuid.UUID):
    spec = await create_product_spec(db_session, company_id=company_id)
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id)
    await create_product_variation(
        db_session, company_id=company_id, product_id=product.id, size=Size.G, color="Azul", color_code="AZU"
    )
    await create_ad(
        db_session,
        company_id=company_id,
        product_id=product.id,
        title="Short 2 em 1 Muay Thai",
        external_id="18398298341",
        ecommerce=Ecommerce.SHOPEE,
    )


async def test_upseller_import_requires_auth(async_client: AsyncClient):
    response = await async_client.post("/v1/orders/import/upseller", **_upload(_csv_bytes(_row())))
    assert response.status_code == 401


async def test_upseller_import_403_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    await _seed_match(db_session, company.id)
    response = await authed_client.post("/v1/orders/import/upseller", **_upload(_csv_bytes(_row())))
    assert response.status_code == 403


async def test_upseller_import_happy_path_and_appears_in_orders_list(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    await _seed_match(db_session, company.id)

    response = await authed_client.post("/v1/orders/import/upseller", **_upload(_csv_bytes(_row())))
    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 1
    assert body["errors"] == []

    # The imported order round-trips through the orders list with null client/price.
    listing = await authed_client.get("/v1/orders")
    assert listing.status_code == 200
    items = listing.json()["items"]
    assert len(items) == 1
    assert items[0]["client"] is None
    assert items[0]["sale_price"] is None
    assert items[0]["external_order_id"] == "260518Q88KUF31"


async def test_upseller_import_dry_run_writes_nothing(authed_client: AsyncClient, db_session):
    company, _ = await _provision_manager(db_session)
    await _seed_match(db_session, company.id)

    response = await authed_client.post("/v1/orders/import/upseller", **_upload(_csv_bytes(_row()), dry_run=True))
    assert response.status_code == 200
    assert response.json()["created"] == 1
    assert response.json()["dry_run"] is True

    listing = await authed_client.get("/v1/orders")
    assert listing.json()["total"] == 0


async def test_upseller_import_reports_unmatched_rows(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    # No catalog seeded → nothing matches.
    response = await authed_client.post("/v1/orders/import/upseller", **_upload(_csv_bytes(_row())))
    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 0
    assert len(body["errors"]) == 1
    assert body["errors"][0]["platform_order_id"] == "260518Q88KUF31"


async def test_upseller_import_rejects_empty_file(authed_client: AsyncClient, db_session):
    await _provision_manager(db_session)
    response = await authed_client.post(
        "/v1/orders/import/upseller",
        files={"file": ("empty.csv", b"", "text/csv")},
        data={"dry_run": "false"},
    )
    assert response.status_code == 400
