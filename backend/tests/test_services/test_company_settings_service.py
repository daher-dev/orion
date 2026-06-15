"""Service-layer tests for per-company catalog settings.

Covers the read-through default (create-on-read), merge-over-defaults, full
config replacement, audit write, and tenant isolation.
"""

from sqlmodel import select

from models import AuditLog, CompanySettings
from services.company_settings import DEFAULT_CONFIG, get_settings, update_settings
from tests.factories import create_company, create_user


async def test_get_settings_creates_row_with_defaults_on_first_read(db_session):
    company = await create_company(db_session)

    settings = await get_settings(db_session, company_id=company.id)
    assert settings.company_id == company.id
    assert settings.config["sizes"] == ["P", "M", "G", "GG", "U"]
    assert settings.config["stockThresholds"]["blank"] == {"enabled": True, "unit": "qty", "value": 20}

    # The row was persisted (create-on-read), not just returned transiently.
    rows = (await db_session.exec(select(CompanySettings).where(CompanySettings.company_id == company.id))).all()
    assert len(rows) == 1


async def test_get_settings_merges_stored_over_defaults(db_session):
    """A row missing a newer default key still surfaces that key on read."""

    company = await create_company(db_session)
    # Persist a partial config (missing techniques + most keys).
    partial = CompanySettings(company_id=company.id, config={"sizes": ["P", "U"]})
    db_session.add(partial)
    await db_session.commit()

    settings = await get_settings(db_session, company_id=company.id)
    # Stored key wins.
    assert settings.config["sizes"] == ["P", "U"]
    # Missing keys fall back to defaults.
    assert settings.config["techniques"] == DEFAULT_CONFIG["techniques"]
    assert "stockThresholds" in settings.config


async def test_get_settings_is_idempotent(db_session):
    company = await create_company(db_session)
    first = await get_settings(db_session, company_id=company.id)
    second = await get_settings(db_session, company_id=company.id)
    assert first.id == second.id
    rows = (await db_session.exec(select(CompanySettings).where(CompanySettings.company_id == company.id))).all()
    assert len(rows) == 1


async def test_update_settings_full_replaces_config_and_audits(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)

    new_config = {
        "productColors": [{"hex": "#000000", "name": "Black"}],
        "printColors": [{"hex": "#ffffff", "name": "White"}],
        "sizes": ["P"],
        "fabricTypes": ["Cotton"],
        "garmentTypes": [{"id": "camiseta", "label": "Tee", "skuPrefix": "CAM", "icon": "camiseta"}],
        "aviamentos": ["Label"],
        "techniques": ["DTF"],
        "stockThresholds": {
            "fabric": {"enabled": False, "unit": "kg", "value": 5},
            "paper": {"enabled": True, "unit": "m", "value": 3},
            "blank": {"enabled": True, "unit": "qty", "value": 1},
            "printed": {"enabled": True, "unit": "qty", "value": 2},
            "product": {"enabled": True, "unit": "qty", "value": 4},
        },
    }
    settings = await update_settings(
        db_session,
        company_id=company.id,
        user_id=user.id,
        config=new_config,
    )
    assert settings.config["sizes"] == ["P"]
    assert settings.config["stockThresholds"]["fabric"]["unit"] == "kg"

    # Read-back keeps the replaced values (and merges defaults for any missing key).
    read = await get_settings(db_session, company_id=company.id)
    assert read.config["sizes"] == ["P"]

    audit = (await db_session.exec(select(AuditLog).where(AuditLog.resource_type == "companies"))).all()
    assert any("Updated company settings" in a.message for a in audit)


async def test_update_settings_upserts_when_no_row_exists(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    config = {**DEFAULT_CONFIG, "sizes": ["GG"]}

    settings = await update_settings(db_session, company_id=company.id, user_id=user.id, config=config)
    assert settings.config["sizes"] == ["GG"]
    rows = (await db_session.exec(select(CompanySettings).where(CompanySettings.company_id == company.id))).all()
    assert len(rows) == 1


async def test_settings_are_tenant_isolated(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_a = await create_user(db_session, company_id=company_a.id)

    config_a = {**DEFAULT_CONFIG, "sizes": ["P"]}
    await update_settings(db_session, company_id=company_a.id, user_id=user_a.id, config=config_a)

    # Company B still gets defaults, not A's config.
    settings_b = await get_settings(db_session, company_id=company_b.id)
    assert settings_b.config["sizes"] == DEFAULT_CONFIG["sizes"]
