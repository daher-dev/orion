import uuid
from datetime import UTC, datetime

import pytest
from sqlmodel import select

from models import (
    AuditLog,
    CuttingOrder,
    CuttingOrderOutput,
    CuttingStatus,
    FabricRollKind,
    Size,
)
from schemas._common import PageParams
from schemas.cutting import (
    CuttingCreate,
    CuttingFilters,
    CuttingUpdate,
    OutputItem,
)
from services import cutting as cutting_service
from shared.exceptions import ConflictError, NotFoundError, ValidationError
from tests.factories import (
    create_company,
    create_cutting_order,
    create_cutting_order_output,
    create_fabric_roll,
    create_product,
    create_product_spec,
    create_sewing_contractor,
    create_sewing_shipment,
    create_user,
)


# ---------------------------------------------------------------- helpers


async def _setup_world(db_session, *, body_kind: FabricRollKind = FabricRollKind.BODY):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="CRP01")
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id, name="Cropped Oversized")
    body_roll = await create_fabric_roll(db_session, company_id=company.id, kind=body_kind)
    rib_roll = await create_fabric_roll(db_session, company_id=company.id, kind=FabricRollKind.RIB)
    return company, user, spec, product, body_roll, rib_roll


async def _audits_for(db_session, *, resource_id: uuid.UUID) -> list[AuditLog]:
    result = await db_session.exec(
        select(AuditLog).where(
            AuditLog.resource_id == resource_id,
            AuditLog.resource_type == "cutting_orders",
        )
    )
    return list(result.all())


# ---------------------------------------------------------------- create


async def test_create_cutting_order_happy_path(db_session):
    company, user, _spec, product, body, _rib = await _setup_world(db_session)

    read = await cutting_service.create_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=CuttingCreate(
            product_id=product.id,
            body_roll_id=body.id,
            planned_outputs=[
                OutputItem(size=Size.M, quantity=20),
                OutputItem(size=Size.G, quantity=10),
            ],
        ),
    )

    assert read.status == CuttingStatus.PENDING
    assert read.product.id == product.id
    assert read.body_roll.id == body.id
    assert read.rib_roll is None
    assert {o.size for o in read.planned_outputs} == {Size.M, Size.G}
    assert sum(o.quantity for o in read.planned_outputs) == 30
    assert read.actual_outputs == []

    audits = await _audits_for(db_session, resource_id=read.id)
    assert any("Created cutting order" in a.message for a in audits)


async def test_create_cutting_order_with_rib(db_session):
    company, user, _spec, product, body, rib = await _setup_world(db_session)
    read = await cutting_service.create_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=CuttingCreate(
            product_id=product.id,
            body_roll_id=body.id,
            rib_roll_id=rib.id,
            planned_outputs=[OutputItem(size=Size.M, quantity=5)],
        ),
    )
    assert read.rib_roll is not None
    assert read.rib_roll.id == rib.id
    assert read.rib_roll.code.startswith("BB-")


async def test_create_rejects_body_equal_to_rib(db_session):
    """Schema-level validator surfaces same-roll attempts."""

    company, _user, _spec, product, body, _rib = await _setup_world(db_session)
    with pytest.raises(ValueError):
        CuttingCreate(
            product_id=product.id,
            body_roll_id=body.id,
            rib_roll_id=body.id,
            planned_outputs=[],
        )
    # No row was inserted.
    rows = (
        await db_session.exec(select(CuttingOrder).where(CuttingOrder.company_id == company.id))
    ).all()
    assert list(rows) == []


async def test_create_service_guard_for_same_roll(db_session):
    """Service raises ConflictError if a caller skipped the schema validator."""

    company, user, _spec, product, body, _rib = await _setup_world(db_session)
    payload = CuttingCreate.model_construct(
        product_id=product.id,
        body_roll_id=body.id,
        rib_roll_id=body.id,
        planned_outputs=[],
        cut_at=None,
    )
    with pytest.raises(ConflictError) as exc:
        await cutting_service.create_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=payload,
        )
    assert "different" in str(exc.value.detail).lower()


async def test_create_rejects_unknown_product(db_session):
    company, user, _spec, _product, body, _rib = await _setup_world(db_session)
    with pytest.raises(ValidationError):
        await cutting_service.create_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=CuttingCreate(
                product_id=uuid.uuid4(),
                body_roll_id=body.id,
                planned_outputs=[],
            ),
        )


async def test_create_rejects_unknown_body_roll(db_session):
    company, user, _spec, product, _body, _rib = await _setup_world(db_session)
    with pytest.raises(ValidationError):
        await cutting_service.create_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=CuttingCreate(
                product_id=product.id,
                body_roll_id=uuid.uuid4(),
                planned_outputs=[],
            ),
        )


async def test_create_rejects_unknown_rib_roll(db_session):
    company, user, _spec, product, body, _rib = await _setup_world(db_session)
    with pytest.raises(ValidationError):
        await cutting_service.create_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=CuttingCreate(
                product_id=product.id,
                body_roll_id=body.id,
                rib_roll_id=uuid.uuid4(),
                planned_outputs=[],
            ),
        )


async def test_create_rejects_cross_tenant_product(db_session):
    company_a, user_a, _spec_a, _product_a, body_a, _rib_a = await _setup_world(db_session)
    company_b = await create_company(db_session)
    spec_b = await create_product_spec(db_session, company_id=company_b.id, code="OTH01")
    product_b = await create_product(db_session, company_id=company_b.id, spec_id=spec_b.id)
    with pytest.raises(ValidationError):
        await cutting_service.create_cutting_order(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            payload=CuttingCreate(
                product_id=product_b.id,
                body_roll_id=body_a.id,
                planned_outputs=[],
            ),
        )


# ----------------------------------------------------------------- get


async def test_get_cutting_order_returns_match(db_session):
    company, _user, _spec, product, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=body.id,
    )
    read = await cutting_service.get_cutting_order(
        db_session, company_id=company.id, order_id=order.id
    )
    assert read.id == order.id
    assert read.product.name == "Cropped Oversized"


async def test_get_cutting_order_not_found(db_session):
    company, _user, _spec, _product, _body, _rib = await _setup_world(db_session)
    with pytest.raises(NotFoundError):
        await cutting_service.get_cutting_order(
            db_session, company_id=company.id, order_id=uuid.uuid4()
        )


async def test_get_isolated_by_tenant(db_session):
    company_a, _user, _spec, product, body, _rib = await _setup_world(db_session)
    company_b = await create_company(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company_a.id,
        product_id=product.id,
        body_roll_id=body.id,
    )
    with pytest.raises(NotFoundError):
        await cutting_service.get_cutting_order(
            db_session, company_id=company_b.id, order_id=order.id
        )


# ----------------------------------------------------------------- list


async def test_list_cutting_orders_pagination(db_session):
    company, _user, _spec, product, body, _rib = await _setup_world(db_session)
    for _ in range(3):
        await create_cutting_order(
            db_session,
            company_id=company.id,
            product_id=product.id,
            body_roll_id=body.id,
        )

    items, total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company.id,
        filters=CuttingFilters(),
        page=PageParams(page=1, page_size=2),
    )
    assert total == 3
    assert len(items) == 2


async def test_list_filter_by_status(db_session):
    company, _user, _spec, product, body, _rib = await _setup_world(db_session)
    await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=body.id,
        status=CuttingStatus.PENDING,
    )
    await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=body.id,
        status=CuttingStatus.DONE,
        cut_at=datetime.now(UTC),
    )

    items, total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company.id,
        filters=CuttingFilters(status=CuttingStatus.DONE),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].status == CuttingStatus.DONE


async def test_list_filter_by_product_id(db_session):
    company, _user, _spec, product, body, _rib = await _setup_world(db_session)
    spec2 = await create_product_spec(db_session, company_id=company.id, code="OTH02")
    product2 = await create_product(db_session, company_id=company.id, spec_id=spec2.id, name="Other")
    await create_cutting_order(
        db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id
    )
    await create_cutting_order(
        db_session, company_id=company.id, product_id=product2.id, body_roll_id=body.id
    )

    items, total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company.id,
        filters=CuttingFilters(product_id=product2.id),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].product.id == product2.id


async def test_list_search_by_product_name(db_session):
    company, _user, _spec, product, body, _rib = await _setup_world(db_session)
    spec2 = await create_product_spec(db_session, company_id=company.id, code="MOL01")
    product2 = await create_product(
        db_session, company_id=company.id, spec_id=spec2.id, name="Moletom Vintage"
    )
    await create_cutting_order(
        db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id
    )
    await create_cutting_order(
        db_session, company_id=company.id, product_id=product2.id, body_roll_id=body.id
    )

    items, total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company.id,
        filters=CuttingFilters(q="moletom"),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].product.name == "Moletom Vintage"


async def test_list_search_by_supplier_name(db_session):
    company, _user, _spec, product, _body, _rib = await _setup_world(db_session)
    weird_supplier = await create_fabric_roll(
        db_session, company_id=company.id, supplier_name="Têxtil Unique XYZ"
    )
    other = await create_fabric_roll(db_session, company_id=company.id)
    await create_cutting_order(
        db_session, company_id=company.id, product_id=product.id, body_roll_id=weird_supplier.id
    )
    await create_cutting_order(
        db_session, company_id=company.id, product_id=product.id, body_roll_id=other.id
    )

    items, total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company.id,
        filters=CuttingFilters(q="unique"),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].body_roll.id == weird_supplier.id


async def test_list_isolated_by_tenant(db_session):
    company_a, _user, _spec, product, body, _rib = await _setup_world(db_session)
    company_b = await create_company(db_session)
    spec_b = await create_product_spec(db_session, company_id=company_b.id, code="OTH03")
    product_b = await create_product(db_session, company_id=company_b.id, spec_id=spec_b.id)
    body_b = await create_fabric_roll(db_session, company_id=company_b.id)
    await create_cutting_order(
        db_session, company_id=company_a.id, product_id=product.id, body_roll_id=body.id
    )
    await create_cutting_order(
        db_session, company_id=company_b.id, product_id=product_b.id, body_roll_id=body_b.id
    )

    items, total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company_a.id,
        filters=CuttingFilters(),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].product.id == product.id


async def test_list_returns_empty_for_new_tenant(db_session):
    company = await create_company(db_session)
    items, total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company.id,
        filters=CuttingFilters(),
        page=PageParams(),
    )
    assert items == []
    assert total == 0


async def test_list_outputs_are_eager_loaded(db_session):
    company, _user, _spec, product, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id
    )
    await create_cutting_order_output(
        db_session, cutting_order_id=order.id, size=Size.P, quantity=5
    )
    await create_cutting_order_output(
        db_session, cutting_order_id=order.id, size=Size.M, quantity=8
    )

    items, _total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company.id,
        filters=CuttingFilters(),
        page=PageParams(),
    )
    assert items[0].planned_outputs
    assert sum(o.quantity for o in items[0].planned_outputs) == 13


# ----------------------------------------------------------------- update


async def test_update_status_pending_to_cutting_writes_audit(db_session):
    company, user, _spec, product, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=body.id,
    )
    read = await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.CUTTING),
    )
    assert read.status == CuttingStatus.CUTTING

    audits = await _audits_for(db_session, resource_id=order.id)
    assert any("CUTTING" in a.message for a in audits)


async def test_update_status_cutting_to_done(db_session):
    company, user, _spec, product, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=body.id,
        status=CuttingStatus.CUTTING,
    )
    read = await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )
    assert read.status == CuttingStatus.DONE


async def test_update_status_done_to_pending_rejected(db_session):
    company, user, _spec, product, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=body.id,
        status=CuttingStatus.DONE,
        cut_at=datetime.now(UTC),
    )
    with pytest.raises(ConflictError):
        await cutting_service.update_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=order.id,
            payload=CuttingUpdate(status=CuttingStatus.PENDING),
        )


async def test_update_status_same_value_no_audit_message_about_transition(db_session):
    company, user, _spec, product, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=body.id,
    )
    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.PENDING),
    )
    audits = await _audits_for(db_session, resource_id=order.id)
    # No transition audit message; a generic "Edited" entry is appended.
    assert not any("MARKED" in a.message.upper() for a in audits)
    assert any("Edited cutting" in a.message for a in audits)


async def test_update_replaces_actual_outputs(db_session):
    company, user, _spec, product, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=body.id,
    )
    await create_cutting_order_output(
        db_session, cutting_order_id=order.id, size=Size.M, quantity=12
    )

    read = await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(
            status=CuttingStatus.CUTTING,
            actual_outputs=[OutputItem(size=Size.M, quantity=5), OutputItem(size=Size.G, quantity=3)],
        ),
    )
    assert {o.size for o in read.actual_outputs} == {Size.M, Size.G}
    assert sum(o.quantity for o in read.actual_outputs) == 8

    rows = (
        await db_session.exec(
            select(CuttingOrderOutput).where(CuttingOrderOutput.cutting_order_id == order.id)
        )
    ).all()
    assert {r.size for r in rows} == {Size.M, Size.G}


async def test_update_actuals_audit_message(db_session):
    company, user, _spec, product, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id
    )
    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(actual_outputs=[OutputItem(size=Size.M, quantity=2)]),
    )
    audits = await _audits_for(db_session, resource_id=order.id)
    assert any("Updated actual outputs" in a.message for a in audits)


async def test_update_cut_at(db_session):
    company, user, _spec, product, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id
    )
    when = datetime.now(UTC)
    read = await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(cut_at=when),
    )
    assert read.cut_at is not None


async def test_update_not_found(db_session):
    company, user, _spec, _product, _body, _rib = await _setup_world(db_session)
    with pytest.raises(NotFoundError):
        await cutting_service.update_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=uuid.uuid4(),
            payload=CuttingUpdate(status=CuttingStatus.CUTTING),
        )


async def test_update_isolated_by_tenant(db_session):
    company_a, _user, _spec, product, body, _rib = await _setup_world(db_session)
    company_b = await create_company(db_session)
    user_b = await create_user(db_session, company_id=company_b.id)
    order = await create_cutting_order(
        db_session, company_id=company_a.id, product_id=product.id, body_roll_id=body.id
    )
    with pytest.raises(NotFoundError):
        await cutting_service.update_cutting_order(
            db_session,
            company_id=company_b.id,
            user_id=user_b.id,
            order_id=order.id,
            payload=CuttingUpdate(status=CuttingStatus.CUTTING),
        )


# ----------------------------------------------------------------- delete


async def test_delete_cutting_order_removes_row(db_session):
    company, user, _spec, product, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id
    )
    await cutting_service.delete_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
    )
    remaining = (await db_session.exec(select(CuttingOrder).where(CuttingOrder.id == order.id))).first()
    assert remaining is None

    audits = await _audits_for(db_session, resource_id=order.id)
    assert any("Deleted cutting order" in a.message for a in audits)


async def test_delete_blocked_when_shipment_exists(db_session):
    company, user, _spec, product, body, _rib = await _setup_world(db_session)
    contractor = await create_sewing_contractor(db_session, company_id=company.id)
    order = await create_cutting_order(
        db_session, company_id=company.id, product_id=product.id, body_roll_id=body.id
    )
    await create_sewing_shipment(
        db_session,
        company_id=company.id,
        cutting_order_id=order.id,
        contractor_id=contractor.id,
    )

    with pytest.raises(ConflictError) as exc:
        await cutting_service.delete_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=order.id,
        )
    assert "shipment" in str(exc.value.detail).lower()


async def test_delete_not_found(db_session):
    company, user, _spec, _product, _body, _rib = await _setup_world(db_session)
    with pytest.raises(NotFoundError):
        await cutting_service.delete_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=uuid.uuid4(),
        )


async def test_delete_isolated_by_tenant(db_session):
    company_a, _user, _spec, product, body, _rib = await _setup_world(db_session)
    company_b = await create_company(db_session)
    user_b = await create_user(db_session, company_id=company_b.id)
    order = await create_cutting_order(
        db_session, company_id=company_a.id, product_id=product.id, body_roll_id=body.id
    )
    with pytest.raises(NotFoundError):
        await cutting_service.delete_cutting_order(
            db_session,
            company_id=company_b.id,
            user_id=user_b.id,
            order_id=order.id,
        )
