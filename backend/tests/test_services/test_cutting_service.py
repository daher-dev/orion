import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlmodel import select

from models import (
    AuditLog,
    CuttingOrder,
    CuttingOrderOutput,
    CuttingStatus,
    FabricMovementKind,
    FabricRoll,
    FabricRollKind,
    FabricRollMovement,
    ShipmentStatus,
    Size,
)
from schemas._common import PageParams
from schemas.cutting import (
    AvailableCutsFilters,
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
    create_product_spec,
    create_sewing_contractor,
    create_sewing_shipment,
    create_sewing_shipment_item,
    create_user,
)

# ---------------------------------------------------------------- helpers


async def _setup_world(db_session, *, body_kind: FabricRollKind = FabricRollKind.BODY, **spec_overrides):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id, code="CRP01", **spec_overrides)
    body_roll = await create_fabric_roll(db_session, company_id=company.id, kind=body_kind)
    rib_roll = await create_fabric_roll(db_session, company_id=company.id, kind=FabricRollKind.RIB)
    return company, user, spec, body_roll, rib_roll


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
    company, user, spec, body, _rib = await _setup_world(db_session)

    read = await cutting_service.create_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=CuttingCreate(
            spec_id=spec.id,
            color="Preto",
            color_code="PRT",
            body_roll_id=body.id,
            planned_outputs=[
                OutputItem(size=Size.M, quantity=20),
                OutputItem(size=Size.G, quantity=10),
            ],
        ),
    )

    assert read.status == CuttingStatus.PENDING
    assert read.spec.id == spec.id
    assert read.spec.code == "CRP01"
    assert read.color == "Preto"
    assert read.color_code == "PRT"
    assert read.body_roll.id == body.id
    assert read.rib_roll is None
    assert {o.size for o in read.planned_outputs} == {Size.M, Size.G}
    assert sum(o.quantity for o in read.planned_outputs) == 30
    assert read.actual_outputs == []

    audits = await _audits_for(db_session, resource_id=read.id)
    assert any("Created cutting order" in a.message for a in audits)


async def test_create_cutting_order_uppercases_color_code(db_session):
    company, user, spec, body, _rib = await _setup_world(db_session)
    read = await cutting_service.create_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=CuttingCreate(spec_id=spec.id, color="Branco", color_code="BCO", body_roll_id=body.id),
    )
    assert read.color_code == "BCO"


async def test_create_cutting_order_with_rib(db_session):
    company, user, spec, body, rib = await _setup_world(db_session)
    read = await cutting_service.create_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=CuttingCreate(
            spec_id=spec.id,
            color="Preto",
            color_code="PRT",
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

    company, _user, spec, body, _rib = await _setup_world(db_session)
    with pytest.raises(ValueError):
        CuttingCreate(
            spec_id=spec.id,
            color="Preto",
            color_code="PRT",
            body_roll_id=body.id,
            rib_roll_id=body.id,
            planned_outputs=[],
        )
    # No row was inserted.
    rows = (await db_session.exec(select(CuttingOrder).where(CuttingOrder.company_id == company.id))).all()
    assert list(rows) == []


async def test_create_rejects_bad_color_code(db_session):
    """color_code must match ^[A-Z]{3}$ (schema-level)."""

    _company, _user, spec, body, _rib = await _setup_world(db_session)
    with pytest.raises(ValueError):
        CuttingCreate(spec_id=spec.id, color="Preto", color_code="pr", body_roll_id=body.id)


async def test_create_service_guard_for_same_roll(db_session):
    """Service raises ConflictError if a caller skipped the schema validator."""

    company, user, spec, body, _rib = await _setup_world(db_session)
    payload = CuttingCreate.model_construct(
        spec_id=spec.id,
        color="Preto",
        color_code="PRT",
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


async def test_create_rejects_unknown_spec(db_session):
    company, user, _spec, body, _rib = await _setup_world(db_session)
    with pytest.raises(ValidationError):
        await cutting_service.create_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=CuttingCreate(spec_id=uuid.uuid4(), color="Preto", color_code="PRT", body_roll_id=body.id),
        )


async def test_create_rejects_unknown_body_roll(db_session):
    company, user, spec, _body, _rib = await _setup_world(db_session)
    with pytest.raises(ValidationError):
        await cutting_service.create_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=CuttingCreate(spec_id=spec.id, color="Preto", color_code="PRT", body_roll_id=uuid.uuid4()),
        )


async def test_create_rejects_unknown_rib_roll(db_session):
    company, user, spec, body, _rib = await _setup_world(db_session)
    with pytest.raises(ValidationError):
        await cutting_service.create_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=CuttingCreate(
                spec_id=spec.id, color="Preto", color_code="PRT", body_roll_id=body.id, rib_roll_id=uuid.uuid4()
            ),
        )


async def test_create_rejects_cross_tenant_spec(db_session):
    company_a, user_a, _spec_a, body_a, _rib_a = await _setup_world(db_session)
    company_b = await create_company(db_session)
    spec_b = await create_product_spec(db_session, company_id=company_b.id, code="OTH01")
    with pytest.raises(ValidationError):
        await cutting_service.create_cutting_order(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            payload=CuttingCreate(spec_id=spec_b.id, color="Preto", color_code="PRT", body_roll_id=body_a.id),
        )


# ----------------------------------------------------------------- get


async def test_get_cutting_order_returns_match(db_session):
    company, _user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=body.id,
    )
    read = await cutting_service.get_cutting_order(db_session, company_id=company.id, order_id=order.id)
    assert read.id == order.id
    assert read.spec.code == "CRP01"
    assert read.color == "Preto"


async def test_get_cutting_order_not_found(db_session):
    company, _user, _spec, _body, _rib = await _setup_world(db_session)
    with pytest.raises(NotFoundError):
        await cutting_service.get_cutting_order(db_session, company_id=company.id, order_id=uuid.uuid4())


async def test_get_isolated_by_tenant(db_session):
    company_a, _user, spec, body, _rib = await _setup_world(db_session)
    company_b = await create_company(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company_a.id,
        spec_id=spec.id,
        body_roll_id=body.id,
    )
    with pytest.raises(NotFoundError):
        await cutting_service.get_cutting_order(db_session, company_id=company_b.id, order_id=order.id)


# ----------------------------------------------------------------- list


async def test_list_cutting_orders_pagination(db_session):
    company, _user, spec, body, _rib = await _setup_world(db_session)
    for _ in range(3):
        await create_cutting_order(
            db_session,
            company_id=company.id,
            spec_id=spec.id,
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
    company, _user, spec, body, _rib = await _setup_world(db_session)
    await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=body.id,
        status=CuttingStatus.PENDING,
    )
    await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
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


async def test_list_filter_by_spec_id(db_session):
    company, _user, spec, body, _rib = await _setup_world(db_session)
    spec2 = await create_product_spec(db_session, company_id=company.id, code="OTH02", name="Other")
    await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
    await create_cutting_order(db_session, company_id=company.id, spec_id=spec2.id, body_roll_id=body.id)

    items, total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company.id,
        filters=CuttingFilters(spec_id=spec2.id),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].spec.id == spec2.id


async def test_list_search_by_spec_name(db_session):
    company, _user, spec, body, _rib = await _setup_world(db_session)
    spec2 = await create_product_spec(db_session, company_id=company.id, code="MOL01", name="Moletom Vintage")
    await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
    await create_cutting_order(db_session, company_id=company.id, spec_id=spec2.id, body_roll_id=body.id)

    items, total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company.id,
        filters=CuttingFilters(q="moletom"),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].spec.name == "Moletom Vintage"


async def test_list_search_by_color(db_session):
    company, _user, spec, body, _rib = await _setup_world(db_session)
    await create_cutting_order(
        db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id, color="Verde-musgo", color_code="MSG"
    )
    await create_cutting_order(
        db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id, color="Preto", color_code="PRT"
    )

    items, total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company.id,
        filters=CuttingFilters(q="musgo"),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].color == "Verde-musgo"


async def test_list_search_by_supplier_name(db_session):
    company, _user, spec, _body, _rib = await _setup_world(db_session)
    weird_supplier = await create_fabric_roll(db_session, company_id=company.id, supplier_name="Têxtil Unique XYZ")
    other = await create_fabric_roll(db_session, company_id=company.id)
    await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=weird_supplier.id)
    await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=other.id)

    items, total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company.id,
        filters=CuttingFilters(q="unique"),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].body_roll.id == weird_supplier.id


async def test_list_isolated_by_tenant(db_session):
    company_a, _user, spec, body, _rib = await _setup_world(db_session)
    company_b = await create_company(db_session)
    spec_b = await create_product_spec(db_session, company_id=company_b.id, code="OTH03")
    body_b = await create_fabric_roll(db_session, company_id=company_b.id)
    await create_cutting_order(db_session, company_id=company_a.id, spec_id=spec.id, body_roll_id=body.id)
    await create_cutting_order(db_session, company_id=company_b.id, spec_id=spec_b.id, body_roll_id=body_b.id)

    items, total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company_a.id,
        filters=CuttingFilters(),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].spec.id == spec.id


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
    company, _user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.P, quantity=5)
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=8)

    items, _total = await cutting_service.list_cutting_orders(
        db_session,
        company_id=company.id,
        filters=CuttingFilters(),
        page=PageParams(),
    )
    assert items[0].planned_outputs
    assert sum(o.quantity for o in items[0].planned_outputs) == 13


# ----------------------------------------------------------------- update + T1


async def test_update_status_pending_to_cutting_writes_audit(db_session):
    company, user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
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
    company, user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=body.id,
        status=CuttingStatus.CUTTING,
    )
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=4)
    read = await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )
    assert read.status == CuttingStatus.DONE


async def test_done_transition_debits_body_fabric(db_session):
    """T1: reaching DONE debits the body roll kg + writes a provenance EXIT movement."""

    # spec: 250 g/piece, no ribana → 10 pieces = 2.5 kg off the body roll.
    company, user, spec, body, _rib = await _setup_world(
        db_session, fabric_weight_per_piece_g=Decimal("250.00"), has_ribana=False, ribana_weight_pct=None
    )
    body.current_weight_kg = Decimal("10.000")
    body.initial_weight_kg = Decimal("10.000")
    db_session.add(body)
    await db_session.commit()

    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=body.id,
        status=CuttingStatus.CUTTING,
    )
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=10)

    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )

    refreshed = (await db_session.exec(select(FabricRoll).where(FabricRoll.id == body.id))).first()
    assert refreshed.current_weight_kg == Decimal("7.500")

    movements = list(
        (await db_session.exec(select(FabricRollMovement).where(FabricRollMovement.cutting_order_id == order.id))).all()
    )
    assert len(movements) == 1
    assert movements[0].kind == FabricMovementKind.EXIT
    assert movements[0].quantity == Decimal("2.500")
    assert movements[0].fabric_roll_id == body.id


async def test_done_transition_rejects_when_body_roll_unassigned(db_session):
    """A planning-created draft (no body roll) cannot reach DONE: T1 needs a roll."""

    company, user, spec, _body, _rib = await _setup_world(db_session)

    # Planning drafts are created PENDING with body_roll_id=None.
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=None,
        status=CuttingStatus.PENDING,
    )
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=10)

    with pytest.raises(ConflictError):
        await cutting_service.update_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=order.id,
            payload=CuttingUpdate(status=CuttingStatus.DONE),
        )

    # The guard fires before any debit/cost work, so no fabric movement is written.
    movements = (
        await db_session.exec(select(FabricRollMovement).where(FabricRollMovement.cutting_order_id == order.id))
    ).all()
    assert list(movements) == []


async def test_done_transition_debits_body_and_rib(db_session):
    """With ribana + a rib roll, both rolls are debited."""

    # 100 g/piece body, ribana 20% → 10 pieces: body 1.0 kg, rib 0.2 kg.
    company, user, spec, body, rib = await _setup_world(
        db_session, fabric_weight_per_piece_g=Decimal("100.00"), has_ribana=True, ribana_weight_pct=Decimal("20.00")
    )
    for roll in (body, rib):
        roll.current_weight_kg = Decimal("5.000")
        roll.initial_weight_kg = Decimal("5.000")
        db_session.add(roll)
    await db_session.commit()

    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=body.id,
        rib_roll_id=rib.id,
        status=CuttingStatus.CUTTING,
    )
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=10)

    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )

    body_r = (await db_session.exec(select(FabricRoll).where(FabricRoll.id == body.id))).first()
    rib_r = (await db_session.exec(select(FabricRoll).where(FabricRoll.id == rib.id))).first()
    assert body_r.current_weight_kg == Decimal("4.000")
    assert rib_r.current_weight_kg == Decimal("4.800")

    movements = list(
        (await db_session.exec(select(FabricRollMovement).where(FabricRollMovement.cutting_order_id == order.id))).all()
    )
    assert {m.fabric_roll_id for m in movements} == {body.id, rib.id}


async def test_done_transition_clamps_fabric_at_zero(db_session):
    """A debit larger than the roll holds clamps current at 0 (metered-roll rule)."""

    company, user, spec, body, _rib = await _setup_world(
        db_session, fabric_weight_per_piece_g=Decimal("250.00"), has_ribana=False, ribana_weight_pct=None
    )
    body.current_weight_kg = Decimal("1.000")  # only 1 kg, need 2.5
    body.initial_weight_kg = Decimal("10.000")
    db_session.add(body)
    await db_session.commit()

    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=body.id,
        status=CuttingStatus.CUTTING,
    )
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=10)

    await cutting_service.update_cutting_order(
        db_session,
        company_id=company.id,
        user_id=user.id,
        order_id=order.id,
        payload=CuttingUpdate(status=CuttingStatus.DONE),
    )

    refreshed = (await db_session.exec(select(FabricRoll).where(FabricRoll.id == body.id))).first()
    assert refreshed.current_weight_kg == Decimal("0.000")
    # The recorded EXIT is the actual consumed amount (clamped to what was held).
    movement = (
        await db_session.exec(select(FabricRollMovement).where(FabricRollMovement.cutting_order_id == order.id))
    ).first()
    assert movement.quantity == Decimal("1.000")


async def test_done_transition_fabric_debit_is_idempotent(db_session):
    """Revert to CUTTING then re-DONE must NOT debit fabric a second time."""

    company, user, spec, body, _rib = await _setup_world(
        db_session, fabric_weight_per_piece_g=Decimal("250.00"), has_ribana=False, ribana_weight_pct=None
    )
    body.current_weight_kg = Decimal("10.000")
    body.initial_weight_kg = Decimal("10.000")
    db_session.add(body)
    await db_session.commit()

    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=body.id,
        status=CuttingStatus.CUTTING,
    )
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=10)

    async def _transition(target):
        await cutting_service.update_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=order.id,
            payload=CuttingUpdate(status=target),
        )

    await _transition(CuttingStatus.DONE)
    await _transition(CuttingStatus.CUTTING)
    await _transition(CuttingStatus.DONE)

    refreshed = (await db_session.exec(select(FabricRoll).where(FabricRoll.id == body.id))).first()
    # Debited exactly once (2.5 kg), not twice.
    assert refreshed.current_weight_kg == Decimal("7.500")
    movements = list(
        (await db_session.exec(select(FabricRollMovement).where(FabricRollMovement.cutting_order_id == order.id))).all()
    )
    assert len(movements) == 1


async def test_update_status_done_to_pending_rejected(db_session):
    company, user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
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
    company, user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
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
    company, user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=body.id,
    )
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=12)

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
        await db_session.exec(select(CuttingOrderOutput).where(CuttingOrderOutput.cutting_order_id == order.id))
    ).all()
    assert {r.size for r in rows} == {Size.M, Size.G}


async def test_update_actuals_audit_message(db_session):
    company, user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
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
    company, user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
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
    company, user, _spec, _body, _rib = await _setup_world(db_session)
    with pytest.raises(NotFoundError):
        await cutting_service.update_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=uuid.uuid4(),
            payload=CuttingUpdate(status=CuttingStatus.CUTTING),
        )


async def test_update_isolated_by_tenant(db_session):
    company_a, _user, spec, body, _rib = await _setup_world(db_session)
    company_b = await create_company(db_session)
    user_b = await create_user(db_session, company_id=company_b.id)
    order = await create_cutting_order(db_session, company_id=company_a.id, spec_id=spec.id, body_roll_id=body.id)
    with pytest.raises(NotFoundError):
        await cutting_service.update_cutting_order(
            db_session,
            company_id=company_b.id,
            user_id=user_b.id,
            order_id=order.id,
            payload=CuttingUpdate(status=CuttingStatus.CUTTING),
        )


# ----------------------------------------------------------- available cuts (T2)


async def test_available_by_size_nets_sent_shipments(db_session):
    company, _user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id, status=CuttingStatus.DONE
    )
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=20)
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.G, quantity=10)
    contractor = await create_sewing_contractor(db_session, company_id=company.id)
    shipment = await create_sewing_shipment(
        db_session, company_id=company.id, cutting_order_id=order.id, contractor_id=contractor.id
    )
    await create_sewing_shipment_item(db_session, shipment_id=shipment.id, size=Size.M, requested_quantity=8)

    avail = await cutting_service.available_by_size(db_session, company_id=company.id, cutting_order_id=order.id)
    assert avail[Size.M] == 12
    assert avail[Size.G] == 10


async def test_available_by_size_excludes_cancelled(db_session):
    company, _user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id, status=CuttingStatus.DONE
    )
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=20)
    contractor = await create_sewing_contractor(db_session, company_id=company.id)
    cancelled = await create_sewing_shipment(
        db_session,
        company_id=company.id,
        cutting_order_id=order.id,
        contractor_id=contractor.id,
        status=ShipmentStatus.CANCELLED,
    )
    await create_sewing_shipment_item(db_session, shipment_id=cancelled.id, size=Size.M, requested_quantity=15)

    avail = await cutting_service.available_by_size(db_session, company_id=company.id, cutting_order_id=order.id)
    # The cancelled shipment releases its committed pieces.
    assert avail[Size.M] == 20


async def test_list_available_cuts_only_done_with_remaining(db_session):
    company, _user, spec, body, _rib = await _setup_world(db_session)
    # A DONE order with remaining pieces.
    done = await create_cutting_order(
        db_session,
        company_id=company.id,
        spec_id=spec.id,
        body_roll_id=body.id,
        status=CuttingStatus.DONE,
        color="Preto",
        color_code="PRT",
    )
    await create_cutting_order_output(db_session, cutting_order_id=done.id, size=Size.M, quantity=12)
    # A pending order — must NOT appear.
    pending = await create_cutting_order(
        db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id, status=CuttingStatus.PENDING
    )
    await create_cutting_order_output(db_session, cutting_order_id=pending.id, size=Size.G, quantity=5)

    rows, total = await cutting_service.list_available_cuts(
        db_session,
        company_id=company.id,
        filters=AvailableCutsFilters(),
        page=PageParams(),
    )
    assert total == 1
    row = rows[0]
    assert row["cutting_order_id"] == done.id
    assert row["code"].startswith("CO-")
    assert row["color"] == "Preto"
    assert row["total_available"] == 12
    assert row["sizes"] == [{"size": Size.M, "available": 12}]


async def test_list_available_cuts_drops_fully_sent(db_session):
    company, _user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id, status=CuttingStatus.DONE
    )
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=10)
    contractor = await create_sewing_contractor(db_session, company_id=company.id)
    shipment = await create_sewing_shipment(
        db_session, company_id=company.id, cutting_order_id=order.id, contractor_id=contractor.id
    )
    await create_sewing_shipment_item(db_session, shipment_id=shipment.id, size=Size.M, requested_quantity=10)

    rows, total = await cutting_service.list_available_cuts(
        db_session,
        company_id=company.id,
        filters=AvailableCutsFilters(),
        page=PageParams(),
    )
    assert total == 0
    assert rows == []


async def test_list_available_cuts_isolated_by_tenant(db_session):
    company_a, _user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(
        db_session, company_id=company_a.id, spec_id=spec.id, body_roll_id=body.id, status=CuttingStatus.DONE
    )
    await create_cutting_order_output(db_session, cutting_order_id=order.id, size=Size.M, quantity=10)
    company_b = await create_company(db_session)
    rows, total = await cutting_service.list_available_cuts(
        db_session,
        company_id=company_b.id,
        filters=AvailableCutsFilters(),
        page=PageParams(),
    )
    assert total == 0
    assert rows == []


# ----------------------------------------------------------------- delete


async def test_delete_cutting_order_removes_row(db_session):
    company, user, spec, body, _rib = await _setup_world(db_session)
    order = await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
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
    company, user, spec, body, _rib = await _setup_world(db_session)
    contractor = await create_sewing_contractor(db_session, company_id=company.id)
    order = await create_cutting_order(db_session, company_id=company.id, spec_id=spec.id, body_roll_id=body.id)
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
    company, user, _spec, _body, _rib = await _setup_world(db_session)
    with pytest.raises(NotFoundError):
        await cutting_service.delete_cutting_order(
            db_session,
            company_id=company.id,
            user_id=user.id,
            order_id=uuid.uuid4(),
        )


async def test_delete_isolated_by_tenant(db_session):
    company_a, _user, spec, body, _rib = await _setup_world(db_session)
    company_b = await create_company(db_session)
    user_b = await create_user(db_session, company_id=company_b.id)
    order = await create_cutting_order(db_session, company_id=company_a.id, spec_id=spec.id, body_roll_id=body.id)
    with pytest.raises(NotFoundError):
        await cutting_service.delete_cutting_order(
            db_session,
            company_id=company_b.id,
            user_id=user_b.id,
            order_id=order.id,
        )
