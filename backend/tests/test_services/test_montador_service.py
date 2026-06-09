import json

import httpx
import pytest
import respx
from sqlmodel import select

from config import config
from models import BatchPrintAdjustment, PrintStockDirection, PrintStockMovement
from services.batch import create_batch
from services.montador import send_batch_to_montador
from shared.exceptions import ValidationError
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_print_design,
    create_product,
    create_product_spec,
    create_product_variation,
    create_user,
)
from tests.factories import (
    create_order as factory_create_order,
)

_URL = "https://montadordtf.test/receberEstampa"


@pytest.fixture(autouse=True)
def _montador_config(monkeypatch):
    monkeypatch.setattr(config, "MONTADOR_URL", _URL)
    monkeypatch.setattr(config, "ORION_MONTADOR_SECRET", "shh")


async def _batch_with_design(db_session, *, montador_email="montador@dtf.test", **design_overrides):
    company = await create_company(db_session, montador_user_email=montador_email)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    design = await create_print_design(db_session, company_id=company.id, **design_overrides)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id, print_id=design.id)
    variation = await create_product_variation(db_session, company_id=company.id, product_id=product.id)
    client = await create_client(db_session, company_id=company.id)
    ad = await create_ad(db_session, company_id=company.id, product_id=product.id)
    order = await factory_create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        quantity=5,
        external_order_id="A1",
    )
    batch, _ = await create_batch(db_session, company_id=company.id, user_id=user.id, order_ids=[order.id])
    return company, user, batch, design


async def test_send_requires_secret(db_session, monkeypatch):
    monkeypatch.setattr(config, "ORION_MONTADOR_SECRET", "")
    company, user, batch, _ = await _batch_with_design(db_session)
    with pytest.raises(ValidationError):
        await send_batch_to_montador(db_session, company_id=company.id, user_id=user.id, batch_id=batch.id)


async def test_send_requires_montador_email(db_session):
    company, user, batch, _ = await _batch_with_design(db_session, montador_email=None)
    with pytest.raises(ValidationError):
        await send_batch_to_montador(db_session, company_id=company.id, user_id=user.id, batch_id=batch.id)


@respx.mock
async def test_send_front_and_back_expands_to_two_with_suffixes(db_session):
    route = respx.post(_URL).mock(return_value=httpx.Response(200, json={"id": "m-1"}))
    company, user, batch, design = await _batch_with_design(
        db_session,
        image_url_front="https://cdn/f.png",
        image_url_back="https://cdn/b.png",
        width_cm="30.00",
        height_cm="40.00",
    )

    result = await send_batch_to_montador(db_session, company_id=company.id, user_id=user.id, batch_id=batch.id)

    assert result["total"] == 2
    assert result["succeeded"] == 2
    assert result["failed"] == 0
    names = {json.loads(c.request.content)["estampa_nome"] for c in route.calls}
    assert f"{design.name} (Frente)" in names
    assert f"{design.name} (Costas)" in names
    # header + dimensions present
    first = json.loads(route.calls[0].request.content)
    assert route.calls[0].request.headers["x-orion-secret"] == "shh"
    assert first["owner_email"] == "montador@dtf.test"
    assert first["quantidade"] == 5
    assert first["largura_cm"] == 30.0

    adj = (await db_session.exec(select(BatchPrintAdjustment).where(BatchPrintAdjustment.batch_id == batch.id))).first()
    assert adj.prints_sent is True
    await db_session.refresh(batch)
    assert batch.prints_sent_at is not None


@respx.mock
async def test_send_front_only_no_suffix(db_session):
    respx.post(_URL).mock(return_value=httpx.Response(200, json={"id": "m-1"}))
    company, user, batch, design = await _batch_with_design(db_session, image_url_front="https://cdn/f.png")
    result = await send_batch_to_montador(db_session, company_id=company.id, user_id=user.id, batch_id=batch.id)
    assert result["total"] == 1
    assert result["succeeded"] == 1
    assert result["results"][0]["design_name"] == design.name


@respx.mock
async def test_send_without_png_records_failure(db_session):
    respx.post(_URL).mock(return_value=httpx.Response(200, json={"id": "m-1"}))
    # No front/back and no legacy image_url.
    company, user, batch, _ = await _batch_with_design(db_session, image_url=None)
    result = await send_batch_to_montador(db_session, company_id=company.id, user_id=user.id, batch_id=batch.id)
    assert result["succeeded"] == 0
    assert result["failed"] == 1
    adj = (await db_session.exec(select(BatchPrintAdjustment).where(BatchPrintAdjustment.batch_id == batch.id))).first()
    assert adj.prints_sent is False


@respx.mock
async def test_send_http_error_marks_failure_and_skips_sent_flag(db_session):
    respx.post(_URL).mock(return_value=httpx.Response(500, json={"error": "boom"}))
    company, user, batch, _ = await _batch_with_design(db_session, image_url_front="https://cdn/f.png")
    result = await send_batch_to_montador(db_session, company_id=company.id, user_id=user.id, batch_id=batch.id)
    assert result["failed"] == 1
    assert result["succeeded"] == 0
    await db_session.refresh(batch)
    assert batch.prints_sent_at is None


@respx.mock
async def test_send_does_not_decrement_print_stock(db_session):
    """The print-stock debit happens on the PRINTED transition, NOT on send.

    Keeping the decrement in exactly one place avoids double-counting when both
    a Montador send and a PRINTED transition occur for the same batch.
    """
    respx.post(_URL).mock(return_value=httpx.Response(200, json={"id": "m-1"}))
    company, user, batch, _ = await _batch_with_design(db_session, image_url_front="https://cdn/f.png")

    await send_batch_to_montador(db_session, company_id=company.id, user_id=user.id, batch_id=batch.id)

    exits = (
        await db_session.exec(
            select(PrintStockMovement).where(
                PrintStockMovement.batch_id == batch.id,
                PrintStockMovement.direction == PrintStockDirection.EXIT,
            )
        )
    ).all()
    assert exits == []
    # And the adjustment is marked sent but not yet stock-committed.
    adj = (await db_session.exec(select(BatchPrintAdjustment).where(BatchPrintAdjustment.batch_id == batch.id))).first()
    assert adj.prints_sent is True
    assert adj.stock_committed_at is None
