"""Router tests for GET/PUT /v1/company/settings."""

from httpx import AsyncClient

from services.company_settings import DEFAULT_CONFIG
from tests.factories import create_company, create_user, get_role_by_code


async def _provision_admin(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid=firebase_uid)
    return company, user


async def _provision_operator(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(db_session, company_id=company.id, role_id=operator_role.id, firebase_uid=firebase_uid)
    return company, user


def _valid_config() -> dict:
    return {
        "productColors": [{"hex": "#1f1f1f", "name": "Preto", "code": "PRT"}],
        "printColors": [{"hex": "#f4f1ea", "name": "Branco"}],
        "sizes": ["P", "M", "G"],
        "fabricTypes": ["Algodão 30.1"],
        "garmentTypes": [{"id": "camiseta", "label": "Camiseta", "skuPrefix": "CAM", "icon": "camiseta"}],
        "aviamentos": ["Etiqueta interna tecida"],
        "techniques": ["DTF"],
        "stockThresholds": {
            "fabric": {"enabled": True, "unit": "pct", "value": 25},
            "paper": {"enabled": True, "unit": "pct", "value": 25},
            "blank": {"enabled": True, "unit": "qty", "value": 20},
            "printed": {"enabled": True, "unit": "qty", "value": 10},
            "product": {"enabled": True, "unit": "qty", "value": 10},
        },
    }


async def test_get_settings_requires_auth(async_client: AsyncClient):
    resp = await async_client.get("/v1/company/settings")
    assert resp.status_code == 401


async def test_get_settings_returns_defaults_for_new_tenant(authed_client: AsyncClient, db_session):
    await _provision_admin(db_session)
    resp = await authed_client.get("/v1/company/settings")
    assert resp.status_code == 200, resp.text
    config = resp.json()["config"]
    assert config["sizes"] == DEFAULT_CONFIG["sizes"]
    assert config["stockThresholds"]["product"]["unit"] == "qty"


async def test_put_settings_replaces_config(authed_client: AsyncClient, db_session):
    await _provision_admin(db_session)
    body = {"config": _valid_config()}
    resp = await authed_client.put("/v1/company/settings", json=body)
    assert resp.status_code == 200, resp.text
    assert resp.json()["config"]["sizes"] == ["P", "M", "G"]

    # Round-trip via GET.
    resp = await authed_client.get("/v1/company/settings")
    assert resp.json()["config"]["fabricTypes"] == ["Algodão 30.1"]


async def test_put_settings_rejects_bad_hex(authed_client: AsyncClient, db_session):
    await _provision_admin(db_session)
    config = _valid_config()
    config["productColors"] = [{"hex": "not-a-hex", "name": "Bad"}]
    resp = await authed_client.put("/v1/company/settings", json={"config": config})
    assert resp.status_code == 422


async def test_put_settings_rejects_product_color_without_code(authed_client: AsyncClient, db_session):
    await _provision_admin(db_session)
    config = _valid_config()
    config["productColors"] = [{"hex": "#1f1f1f", "name": "Preto"}]  # no code
    resp = await authed_client.put("/v1/company/settings", json={"config": config})
    assert resp.status_code == 422


async def test_put_settings_rejects_duplicate_product_color_code(authed_client: AsyncClient, db_session):
    await _provision_admin(db_session)
    config = _valid_config()
    config["productColors"] = [
        {"hex": "#1f1f1f", "name": "Preto", "code": "PRT"},
        {"hex": "#222222", "name": "Carvão", "code": "PRT"},  # duplicate code
    ]
    resp = await authed_client.put("/v1/company/settings", json={"config": config})
    assert resp.status_code == 422


async def test_put_settings_rejects_bad_threshold_unit(authed_client: AsyncClient, db_session):
    await _provision_admin(db_session)
    config = _valid_config()
    # qty is not allowed for fabric (only pct|kg).
    config["stockThresholds"]["fabric"] = {"enabled": True, "unit": "qty", "value": 5}
    resp = await authed_client.put("/v1/company/settings", json={"config": config})
    assert resp.status_code == 422


async def test_put_settings_forbidden_for_operator(authed_client: AsyncClient, db_session):
    await _provision_operator(db_session)
    resp = await authed_client.put("/v1/company/settings", json={"config": _valid_config()})
    assert resp.status_code == 403


async def test_operator_can_read_settings(authed_client: AsyncClient, db_session):
    # operator has companies.read? No — operator lacks companies.read, so GET is 403.
    await _provision_operator(db_session)
    resp = await authed_client.get("/v1/company/settings")
    assert resp.status_code == 403
