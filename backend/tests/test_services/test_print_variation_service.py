"""Service-layer tests for estampa colour variations + artwork.

Covers nested CRUD, server-derived artwork status, the artwork setter, audit
writes, and tenant isolation (a variation is reachable only under its own
print + company).
"""

import uuid

import pytest
from sqlmodel import select

from models import AuditLog, PrintDesignVariation
from models.enums import ArtworkStatus, PrintSide
from schemas.print_design import PrintVariationCreate, PrintVariationUpdate
from services.print_design import (
    create_variation,
    delete_variation,
    get_print,
    get_variation,
    list_variations,
    set_variation_artwork,
    update_variation,
)
from shared.exceptions import NotFoundError
from tests.factories import create_company, create_print_design, create_user


async def _setup(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    design = await create_print_design(db_session, company_id=company.id)
    return company, user, design


async def test_create_variation_derives_pending_status_without_files(db_session):
    company, user, design = await _setup(db_session)
    variation = await create_variation(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        payload=PrintVariationCreate(name="Branco", ink_hex="#f4f1ea"),
    )
    assert variation.print_design_id == design.id
    assert variation.front_status == ArtworkStatus.PENDING
    assert variation.back_status == ArtworkStatus.PENDING


async def test_create_variation_derives_ok_when_file_url_given(db_session):
    company, user, design = await _setup(db_session)
    variation = await create_variation(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        payload=PrintVariationCreate(name="Preto", ink_hex="#1f1f1f", front_file_url="https://cdn/x.png"),
    )
    assert variation.front_status == ArtworkStatus.OK
    assert variation.back_status == ArtworkStatus.PENDING


async def test_create_variation_writes_audit(db_session):
    company, user, design = await _setup(db_session)
    await create_variation(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        payload=PrintVariationCreate(name="Areia", ink_hex="#cfb98e"),
    )
    audit = (await db_session.exec(select(AuditLog).where(AuditLog.resource_id == design.id))).all()
    assert any("Added variation Areia" in a.message for a in audit)


async def test_create_variation_unknown_print_404(db_session):
    company, user, _ = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await create_variation(
            db_session,
            company_id=company.id,
            user_id=user.id,
            print_id=uuid.uuid4(),
            payload=PrintVariationCreate(name="X", ink_hex="#000000"),
        )


async def test_get_print_embeds_ordered_variations(db_session):
    company, user, design = await _setup(db_session)
    await create_variation(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        payload=PrintVariationCreate(name="A", ink_hex="#111111"),
    )
    await create_variation(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        payload=PrintVariationCreate(name="B", ink_hex="#222222"),
    )
    _print, variations = await get_print(db_session, company_id=company.id, print_id=design.id)
    assert [v.name for v in variations] == ["A", "B"]


async def test_update_variation_redrives_status_when_url_cleared(db_session):
    company, user, design = await _setup(db_session)
    variation = await create_variation(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        payload=PrintVariationCreate(name="Preto", ink_hex="#1f1f1f", front_file_url="https://cdn/x.png"),
    )
    assert variation.front_status == ArtworkStatus.OK

    updated = await update_variation(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        variation_id=variation.id,
        payload=PrintVariationUpdate(front_file_url=None),
    )
    assert updated.front_status == ArtworkStatus.PENDING
    assert updated.front_file_url is None


async def test_update_variation_changes_name_and_ink(db_session):
    company, user, design = await _setup(db_session)
    variation = await create_variation(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        payload=PrintVariationCreate(name="Old", ink_hex="#1f1f1f"),
    )
    updated = await update_variation(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        variation_id=variation.id,
        payload=PrintVariationUpdate(name="New", ink_hex="#abcdef"),
    )
    assert updated.name == "New"
    assert updated.ink_hex == "#abcdef"


async def test_delete_variation_removes_row(db_session):
    company, user, design = await _setup(db_session)
    variation = await create_variation(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        payload=PrintVariationCreate(name="Gone", ink_hex="#1f1f1f"),
    )
    await delete_variation(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        variation_id=variation.id,
    )
    remaining = (
        await db_session.exec(select(PrintDesignVariation).where(PrintDesignVariation.id == variation.id))
    ).all()
    assert remaining == []


async def test_set_variation_artwork_sets_url_and_status(db_session):
    company, user, design = await _setup(db_session)
    variation = await create_variation(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        payload=PrintVariationCreate(name="Preto", ink_hex="#1f1f1f"),
    )
    updated = await set_variation_artwork(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        variation_id=variation.id,
        side=PrintSide.BACK,
        file_url="https://cdn/back.png",
    )
    assert updated.back_file_url == "https://cdn/back.png"
    assert updated.back_status == ArtworkStatus.OK
    assert updated.front_status == ArtworkStatus.PENDING


async def test_variation_tenant_isolation(db_session):
    company_a, user_a, design_a = await _setup(db_session)
    company_b, _user_b, _design_b = await _setup(db_session)
    variation = await create_variation(
        db_session,
        company_id=company_a.id,
        user_id=user_a.id,
        print_id=design_a.id,
        payload=PrintVariationCreate(name="A", ink_hex="#111111"),
    )
    # Same variation id, wrong tenant -> not found.
    with pytest.raises(NotFoundError):
        await get_variation(db_session, company_id=company_b.id, print_id=design_a.id, variation_id=variation.id)


async def test_get_variation_wrong_print_404(db_session):
    company, user, design = await _setup(db_session)
    other_design = await create_print_design(db_session, company_id=company.id)
    variation = await create_variation(
        db_session,
        company_id=company.id,
        user_id=user.id,
        print_id=design.id,
        payload=PrintVariationCreate(name="A", ink_hex="#111111"),
    )
    with pytest.raises(NotFoundError):
        await get_variation(db_session, company_id=company.id, print_id=other_design.id, variation_id=variation.id)


async def test_list_variations_unknown_print_404(db_session):
    company, _user, _design = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await list_variations(db_session, company_id=company.id, print_id=uuid.uuid4())
