"""Service tests for the order separation / labeling / check-out workflow."""

import uuid

import pytest
from sqlmodel import select

from models import OrderItem, SeparationStatus
from services import order_item as service
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import (
    create_ad,
    create_client,
    create_company,
    create_order,
    create_order_item,
    create_product,
    create_product_spec,
    create_product_variation,
    create_user,
)


async def _seed_order(db_session, *, quantity: int = 3):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    variation = await create_product_variation(db_session, company_id=company.id, product_id=product.id)
    ad = await create_ad(db_session, company_id=company.id, product_id=product.id)
    client = await create_client(db_session, company_id=company.id)
    order = await create_order(
        db_session,
        company_id=company.id,
        ad_id=ad.id,
        variation_id=variation.id,
        client_id=client.id,
        quantity=quantity,
    )
    return company, user, order, variation


# --------------------------------------------------------------- generate_labels


async def test_generate_labels_materializes_one_piece_per_quantity(db_session):
    company, user, order, _ = await _seed_order(db_session, quantity=3)

    result = await service.generate_labels(db_session, company_id=company.id, user_id=user.id, order_id=order.id)

    assert result.total_items == 3
    assert len(result.labels) == 3
    indices = sorted(label.item_index for label in result.labels)
    assert indices == [1, 2, 3]
    assert all(label.total_items == 3 for label in result.labels)
    assert all(label.status == SeparationStatus.LABEL_PRINTED for label in result.labels)
    # Each label carries a unique, non-empty tracking code and the QR encodes it.
    codes = {label.tracking_code for label in result.labels}
    assert len(codes) == 3
    assert all(label.qr_data == label.tracking_code and label.tracking_code for label in result.labels)
    assert all(label.order_code.startswith("ORD-") for label in result.labels)


async def test_generate_labels_populates_label_face_from_variation(db_session):
    company, user, order, variation = await _seed_order(db_session, quantity=1)

    result = await service.generate_labels(db_session, company_id=company.id, user_id=user.id, order_id=order.id)

    label = result.labels[0]
    assert label.sku == variation.sku
    assert label.color == variation.color
    assert label.color_code == variation.color_code
    assert label.size == variation.size
    assert label.product_name is not None


async def test_generate_labels_is_idempotent_no_duplicate_pieces(db_session):
    company, user, order, _ = await _seed_order(db_session, quantity=2)

    first = await service.generate_labels(db_session, company_id=company.id, user_id=user.id, order_id=order.id)
    second = await service.generate_labels(db_session, company_id=company.id, user_id=user.id, order_id=order.id)

    assert first.total_items == second.total_items == 2
    # Re-running must reuse the same pieces (same tracking codes), not insert new ones.
    assert {label.tracking_code for label in first.labels} == {label.tracking_code for label in second.labels}

    rows = (await db_session.exec(select(OrderItem).where(OrderItem.order_id == order.id))).all()
    assert len(rows) == 2


async def test_generate_labels_does_not_reset_checked_piece(db_session):
    company, user, order, variation = await _seed_order(db_session, quantity=1)
    piece = await create_order_item(
        db_session,
        company_id=company.id,
        order_id=order.id,
        variation_id=variation.id,
        tracking_code="ABC123",
        status=SeparationStatus.CHECKED,
        item_index=1,
        total_items=1,
    )

    result = await service.generate_labels(db_session, company_id=company.id, user_id=user.id, order_id=order.id)

    assert len(result.labels) == 1
    assert result.labels[0].status == SeparationStatus.CHECKED
    await db_session.refresh(piece)
    assert piece.status == SeparationStatus.CHECKED


async def test_generate_labels_flips_pending_existing_piece_to_label_printed(db_session):
    company, user, order, variation = await _seed_order(db_session, quantity=1)
    await create_order_item(
        db_session,
        company_id=company.id,
        order_id=order.id,
        variation_id=variation.id,
        tracking_code="PND001",
        status=SeparationStatus.PENDING,
        item_index=1,
        total_items=1,
    )

    result = await service.generate_labels(db_session, company_id=company.id, user_id=user.id, order_id=order.id)

    assert result.labels[0].status == SeparationStatus.LABEL_PRINTED


async def test_generate_labels_unknown_order_404(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    with pytest.raises(NotFoundError):
        await service.generate_labels(db_session, company_id=company.id, user_id=user.id, order_id=uuid.uuid4())


async def test_generate_labels_other_tenant_order_404(db_session):
    _company, _user, order, _ = await _seed_order(db_session, quantity=1)
    other = await create_company(db_session)
    other_user = await create_user(db_session, company_id=other.id, firebase_uid="other-uid")
    with pytest.raises(NotFoundError):
        await service.generate_labels(db_session, company_id=other.id, user_id=other_user.id, order_id=order.id)


# ------------------------------------------------------------------- scan_check


async def test_scan_check_sets_checked_audit(db_session):
    company, user, order, _ = await _seed_order(db_session, quantity=1)
    result = await service.generate_labels(db_session, company_id=company.id, user_id=user.id, order_id=order.id)
    code = result.labels[0].tracking_code

    scanned = await service.scan_check(
        db_session,
        company_id=company.id,
        user_id=user.id,
        user_email="picker@orion.local",
        tracking_code=code,
    )

    assert scanned.status == SeparationStatus.CHECKED
    assert scanned.checked_by == "picker@orion.local"
    assert scanned.checked_at is not None
    assert scanned.already_checked is False


async def test_scan_check_is_idempotent_when_already_checked(db_session):
    company, user, order, _ = await _seed_order(db_session, quantity=1)
    result = await service.generate_labels(db_session, company_id=company.id, user_id=user.id, order_id=order.id)
    code = result.labels[0].tracking_code

    await service.scan_check(
        db_session, company_id=company.id, user_id=user.id, user_email="a@orion.local", tracking_code=code
    )
    again = await service.scan_check(
        db_session, company_id=company.id, user_id=user.id, user_email="b@orion.local", tracking_code=code
    )

    assert again.already_checked is True
    assert again.status == SeparationStatus.CHECKED
    # The original check-out audit (who) is preserved — not overwritten.
    assert again.checked_by == "a@orion.local"


async def test_scan_check_rejects_still_pending_piece(db_session):
    company, user, order, variation = await _seed_order(db_session, quantity=1)
    await create_order_item(
        db_session,
        company_id=company.id,
        order_id=order.id,
        variation_id=variation.id,
        tracking_code="PEND99",
        status=SeparationStatus.PENDING,
        item_index=1,
        total_items=1,
    )

    with pytest.raises(ConflictError):
        await service.scan_check(
            db_session,
            company_id=company.id,
            user_id=user.id,
            user_email="x@orion.local",
            tracking_code="PEND99",
        )


async def test_scan_check_unknown_code_404(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    with pytest.raises(NotFoundError):
        await service.scan_check(
            db_session,
            company_id=company.id,
            user_id=user.id,
            user_email="x@orion.local",
            tracking_code="DOES-NOT-EXIST",
        )


async def test_scan_check_is_tenant_scoped(db_session):
    company, user, order, _ = await _seed_order(db_session, quantity=1)
    result = await service.generate_labels(db_session, company_id=company.id, user_id=user.id, order_id=order.id)
    code = result.labels[0].tracking_code

    other = await create_company(db_session)
    other_user = await create_user(db_session, company_id=other.id, firebase_uid="other-uid")

    # A different tenant cannot resolve another company's tracking code.
    with pytest.raises(NotFoundError):
        await service.scan_check(
            db_session,
            company_id=other.id,
            user_id=other_user.id,
            user_email="intruder@orion.local",
            tracking_code=code,
        )
