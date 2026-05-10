import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from sqlmodel import select

from models import AuditLog, FabricRoll, FabricRollKind, FabricType
from schemas._common import PageParams
from schemas.fabric import (
    FabricRollCreate,
    FabricRollFilters,
    FabricRollUpdate,
)
from services import fabric as fabric_service
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import (
    create_company,
    create_cutting_order,
    create_fabric_roll,
    create_product,
    create_product_spec,
    create_user,
)


async def _setup(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    return company, user


async def _audits_for(db_session, *, resource_id: uuid.UUID) -> list[AuditLog]:
    result = await db_session.exec(
        select(AuditLog).where(
            AuditLog.resource_id == resource_id,
            AuditLog.resource_type == "fabric_rolls",
        )
    )
    return list(result.all())


def _payload(**overrides) -> FabricRollCreate:
    base = {
        "received_at": date(2026, 5, 1),
        "supplier_name": "Malharia Estrela",
        "kind": FabricRollKind.BODY,
        "fabric_type": FabricType.JERSEY,
        "initial_weight_kg": Decimal("25.000"),
        "color": "Off-white",
        "price_per_kg": Decimal("38.00"),
    }
    base.update(overrides)
    return FabricRollCreate(**base)


# ---------- create_fabric_roll ----------


async def test_create_fabric_roll_happy_path(db_session):
    company, user = await _setup(db_session)
    roll = await fabric_service.create_fabric_roll(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=_payload(),
    )

    assert roll.id is not None
    assert roll.company_id == company.id
    assert roll.supplier_name == "Malharia Estrela"
    assert roll.kind == FabricRollKind.BODY
    assert roll.fabric_type == FabricType.JERSEY
    assert roll.initial_weight_kg == Decimal("25.000")
    assert roll.current_weight_kg == Decimal("25.000")
    assert roll.color == "Off-white"
    assert roll.price_per_kg == Decimal("38.00")

    audits = await _audits_for(db_session, resource_id=roll.id)
    assert any("Fabric roll created" in a.message for a in audits)


async def test_create_fabric_roll_defaults_current_to_initial(db_session):
    company, user = await _setup(db_session)
    roll = await fabric_service.create_fabric_roll(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=_payload(initial_weight_kg=Decimal("30.000")),
    )
    assert roll.current_weight_kg == Decimal("30.000")


async def test_create_fabric_roll_uses_provided_current_weight(db_session):
    company, user = await _setup(db_session)
    roll = await fabric_service.create_fabric_roll(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=_payload(
            initial_weight_kg=Decimal("30.000"),
            current_weight_kg=Decimal("18.500"),
        ),
    )
    assert roll.initial_weight_kg == Decimal("30.000")
    assert roll.current_weight_kg == Decimal("18.500")


async def test_create_fabric_roll_strips_whitespace(db_session):
    company, user = await _setup(db_session)
    roll = await fabric_service.create_fabric_roll(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=_payload(supplier_name="  Malharia X  ", color="  Preto  "),
    )
    assert roll.supplier_name == "Malharia X"
    assert roll.color == "Preto"


async def test_create_fabric_roll_rejects_current_above_initial(db_session):
    company, user = await _setup(db_session)
    with pytest.raises(ConflictError) as exc:
        await fabric_service.create_fabric_roll(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=_payload(
                initial_weight_kg=Decimal("10.000"),
                current_weight_kg=Decimal("12.000"),
            ),
        )
    assert "exceed" in str(exc.value.detail).lower()


async def test_create_fabric_roll_isolated_by_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_a = await create_user(db_session, company_id=company_a.id)
    user_b = await create_user(db_session, company_id=company_b.id)

    roll_a = await fabric_service.create_fabric_roll(
        db_session, company_id=company_a.id, user_id=user_a.id, payload=_payload()
    )
    roll_b = await fabric_service.create_fabric_roll(
        db_session, company_id=company_b.id, user_id=user_b.id, payload=_payload()
    )

    assert roll_a.id != roll_b.id
    assert roll_a.company_id == company_a.id
    assert roll_b.company_id == company_b.id


# ---------- get_fabric_roll ----------


async def test_get_fabric_roll_returns_match(db_session):
    company, _ = await _setup(db_session)
    seed = await create_fabric_roll(db_session, company_id=company.id)

    fetched = await fabric_service.get_fabric_roll(db_session, company_id=company.id, roll_id=seed.id)
    assert fetched.id == seed.id


async def test_get_fabric_roll_not_found_unknown_id(db_session):
    company, _ = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await fabric_service.get_fabric_roll(db_session, company_id=company.id, roll_id=uuid.uuid4())


async def test_get_fabric_roll_isolated_by_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    seed = await create_fabric_roll(db_session, company_id=company_a.id)

    with pytest.raises(NotFoundError):
        await fabric_service.get_fabric_roll(db_session, company_id=company_b.id, roll_id=seed.id)


# ---------- list_fabric_rolls ----------


async def test_list_fabric_rolls_returns_paginated_result(db_session):
    company, _ = await _setup(db_session)
    for _ in range(3):
        await create_fabric_roll(db_session, company_id=company.id)

    items, total = await fabric_service.list_fabric_rolls(
        db_session,
        company_id=company.id,
        filters=FabricRollFilters(),
        page=PageParams(page=1, page_size=50),
    )
    assert total == 3
    assert len(items) == 3


async def test_list_fabric_rolls_respects_page_size(db_session):
    company, _ = await _setup(db_session)
    for _ in range(5):
        await create_fabric_roll(db_session, company_id=company.id)

    items, total = await fabric_service.list_fabric_rolls(
        db_session,
        company_id=company.id,
        filters=FabricRollFilters(),
        page=PageParams(page=1, page_size=2),
    )
    assert total == 5
    assert len(items) == 2


async def test_list_fabric_rolls_filters_by_supplier_search(db_session):
    company, _ = await _setup(db_session)
    await create_fabric_roll(db_session, company_id=company.id, supplier_name="Malharia Estrela")
    await create_fabric_roll(db_session, company_id=company.id, supplier_name="Têxtil Nordeste")

    items, total = await fabric_service.list_fabric_rolls(
        db_session,
        company_id=company.id,
        filters=FabricRollFilters(q="estrela"),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].supplier_name == "Malharia Estrela"


async def test_list_fabric_rolls_filters_by_color_search(db_session):
    company, _ = await _setup(db_session)
    await create_fabric_roll(db_session, company_id=company.id, color="Off-white")
    await create_fabric_roll(db_session, company_id=company.id, color="Preto")

    items, total = await fabric_service.list_fabric_rolls(
        db_session,
        company_id=company.id,
        filters=FabricRollFilters(q="preto"),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].color == "Preto"


async def test_list_fabric_rolls_filters_by_fabric_type_search(db_session):
    company, _ = await _setup(db_session)
    await create_fabric_roll(db_session, company_id=company.id, fabric_type=FabricType.JERSEY)
    await create_fabric_roll(db_session, company_id=company.id, fabric_type=FabricType.FLEECE)

    items, total = await fabric_service.list_fabric_rolls(
        db_session,
        company_id=company.id,
        filters=FabricRollFilters(q="fleece"),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].fabric_type == FabricType.FLEECE


async def test_list_fabric_rolls_filters_by_kind(db_session):
    company, _ = await _setup(db_session)
    await create_fabric_roll(db_session, company_id=company.id, kind=FabricRollKind.BODY)
    await create_fabric_roll(db_session, company_id=company.id, kind=FabricRollKind.RIB)

    items, total = await fabric_service.list_fabric_rolls(
        db_session,
        company_id=company.id,
        filters=FabricRollFilters(kind=FabricRollKind.RIB),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].kind == FabricRollKind.RIB


async def test_list_fabric_rolls_filters_by_fabric_type(db_session):
    company, _ = await _setup(db_session)
    await create_fabric_roll(db_session, company_id=company.id, fabric_type=FabricType.MESH)
    await create_fabric_roll(db_session, company_id=company.id, fabric_type=FabricType.RIB)

    items, total = await fabric_service.list_fabric_rolls(
        db_session,
        company_id=company.id,
        filters=FabricRollFilters(fabric_type=FabricType.MESH),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].fabric_type == FabricType.MESH


async def test_list_fabric_rolls_orders_by_received_at_desc(db_session):
    company, _ = await _setup(db_session)
    today = date(2026, 5, 1)
    older = today - timedelta(days=10)
    newer = today + timedelta(days=2)

    await create_fabric_roll(db_session, company_id=company.id, received_at=older, supplier_name="Old")
    await create_fabric_roll(db_session, company_id=company.id, received_at=newer, supplier_name="New")
    await create_fabric_roll(db_session, company_id=company.id, received_at=today, supplier_name="Mid")

    items, _ = await fabric_service.list_fabric_rolls(
        db_session,
        company_id=company.id,
        filters=FabricRollFilters(),
        page=PageParams(),
    )
    assert [r.supplier_name for r in items] == ["New", "Mid", "Old"]


async def test_list_fabric_rolls_isolated_by_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    await create_fabric_roll(db_session, company_id=company_a.id, supplier_name="A")
    await create_fabric_roll(db_session, company_id=company_b.id, supplier_name="B")

    items, total = await fabric_service.list_fabric_rolls(
        db_session,
        company_id=company_a.id,
        filters=FabricRollFilters(),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].supplier_name == "A"


# ---------- update_fabric_roll ----------


async def test_update_fabric_roll_changes_fields(db_session):
    company, user = await _setup(db_session)
    seed = await create_fabric_roll(
        db_session,
        company_id=company.id,
        initial_weight_kg=Decimal("20.000"),
        current_weight_kg=Decimal("20.000"),
        supplier_name="Old Supplier",
    )

    updated = await fabric_service.update_fabric_roll(
        db_session,
        company_id=company.id,
        user_id=user.id,
        roll_id=seed.id,
        payload=FabricRollUpdate(
            supplier_name="New Supplier",
            current_weight_kg=Decimal("12.500"),
            price_per_kg=Decimal("42.00"),
        ),
    )

    assert updated.supplier_name == "New Supplier"
    assert updated.current_weight_kg == Decimal("12.500")
    assert updated.price_per_kg == Decimal("42.00")
    # Untouched fields stay the same.
    assert updated.initial_weight_kg == Decimal("20.000")

    audits = await _audits_for(db_session, resource_id=seed.id)
    assert any("Fabric roll updated" in a.message for a in audits)


async def test_update_fabric_roll_partial_only_changes_provided(db_session):
    company, user = await _setup(db_session)
    seed = await create_fabric_roll(
        db_session,
        company_id=company.id,
        supplier_name="Keep",
        color="Preto",
    )

    updated = await fabric_service.update_fabric_roll(
        db_session,
        company_id=company.id,
        user_id=user.id,
        roll_id=seed.id,
        payload=FabricRollUpdate(color="Off-white"),
    )
    assert updated.color == "Off-white"
    assert updated.supplier_name == "Keep"


async def test_update_fabric_roll_strips_whitespace(db_session):
    company, user = await _setup(db_session)
    seed = await create_fabric_roll(db_session, company_id=company.id)
    updated = await fabric_service.update_fabric_roll(
        db_session,
        company_id=company.id,
        user_id=user.id,
        roll_id=seed.id,
        payload=FabricRollUpdate(supplier_name="  Padded  ", color="  Cor  "),
    )
    assert updated.supplier_name == "Padded"
    assert updated.color == "Cor"


async def test_update_fabric_roll_rejects_current_above_initial(db_session):
    company, user = await _setup(db_session)
    seed = await create_fabric_roll(
        db_session,
        company_id=company.id,
        initial_weight_kg=Decimal("15.000"),
        current_weight_kg=Decimal("15.000"),
    )
    with pytest.raises(ConflictError) as exc:
        await fabric_service.update_fabric_roll(
            db_session,
            company_id=company.id,
            user_id=user.id,
            roll_id=seed.id,
            payload=FabricRollUpdate(current_weight_kg=Decimal("16.000")),
        )
    assert "exceed" in str(exc.value.detail).lower()


async def test_update_fabric_roll_rejects_initial_below_current(db_session):
    company, user = await _setup(db_session)
    seed = await create_fabric_roll(
        db_session,
        company_id=company.id,
        initial_weight_kg=Decimal("20.000"),
        current_weight_kg=Decimal("12.000"),
    )
    # Lowering initial below current must also fail the invariant.
    with pytest.raises(ConflictError):
        await fabric_service.update_fabric_roll(
            db_session,
            company_id=company.id,
            user_id=user.id,
            roll_id=seed.id,
            payload=FabricRollUpdate(initial_weight_kg=Decimal("10.000")),
        )


async def test_update_fabric_roll_allows_kind_and_type_change(db_session):
    company, user = await _setup(db_session)
    seed = await create_fabric_roll(
        db_session,
        company_id=company.id,
        kind=FabricRollKind.BODY,
        fabric_type=FabricType.JERSEY,
    )
    updated = await fabric_service.update_fabric_roll(
        db_session,
        company_id=company.id,
        user_id=user.id,
        roll_id=seed.id,
        payload=FabricRollUpdate(kind=FabricRollKind.RIB, fabric_type=FabricType.RIB),
    )
    assert updated.kind == FabricRollKind.RIB
    assert updated.fabric_type == FabricType.RIB


async def test_update_fabric_roll_can_change_received_at(db_session):
    company, user = await _setup(db_session)
    seed = await create_fabric_roll(db_session, company_id=company.id, received_at=date(2026, 4, 1))
    updated = await fabric_service.update_fabric_roll(
        db_session,
        company_id=company.id,
        user_id=user.id,
        roll_id=seed.id,
        payload=FabricRollUpdate(received_at=date(2026, 4, 5)),
    )
    assert updated.received_at == date(2026, 4, 5)


async def test_update_fabric_roll_can_grow_initial_weight(db_session):
    company, user = await _setup(db_session)
    seed = await create_fabric_roll(
        db_session,
        company_id=company.id,
        initial_weight_kg=Decimal("10.000"),
        current_weight_kg=Decimal("5.000"),
    )
    updated = await fabric_service.update_fabric_roll(
        db_session,
        company_id=company.id,
        user_id=user.id,
        roll_id=seed.id,
        payload=FabricRollUpdate(initial_weight_kg=Decimal("12.000")),
    )
    assert updated.initial_weight_kg == Decimal("12.000")


async def test_update_fabric_roll_not_found(db_session):
    company, user = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await fabric_service.update_fabric_roll(
            db_session,
            company_id=company.id,
            user_id=user.id,
            roll_id=uuid.uuid4(),
            payload=FabricRollUpdate(supplier_name="X"),
        )


# ---------- delete_fabric_roll ----------


async def test_delete_fabric_roll_removes_row(db_session):
    company, user = await _setup(db_session)
    seed = await create_fabric_roll(db_session, company_id=company.id)

    await fabric_service.delete_fabric_roll(
        db_session,
        company_id=company.id,
        user_id=user.id,
        roll_id=seed.id,
    )

    remaining = (await db_session.exec(select(FabricRoll).where(FabricRoll.id == seed.id))).first()
    assert remaining is None

    audits = await _audits_for(db_session, resource_id=seed.id)
    assert any("Fabric roll deleted" in a.message for a in audits)


async def test_delete_fabric_roll_blocked_when_linked_to_cutting_order(db_session):
    company, user = await _setup(db_session)
    roll = await create_fabric_roll(db_session, company_id=company.id)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=roll.id,
    )

    with pytest.raises(ConflictError) as exc:
        await fabric_service.delete_fabric_roll(
            db_session,
            company_id=company.id,
            user_id=user.id,
            roll_id=roll.id,
        )
    assert "referenced" in str(exc.value.detail).lower()

    # Roll must remain after the failed delete.
    still = (await db_session.exec(select(FabricRoll).where(FabricRoll.id == roll.id))).first()
    assert still is not None


async def test_delete_fabric_roll_blocked_when_linked_as_rib_roll(db_session):
    company, user = await _setup(db_session)
    body = await create_fabric_roll(db_session, company_id=company.id, kind=FabricRollKind.BODY)
    rib = await create_fabric_roll(db_session, company_id=company.id, kind=FabricRollKind.RIB)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(db_session, company_id=company.id, spec_id=spec.id)
    await create_cutting_order(
        db_session,
        company_id=company.id,
        product_id=product.id,
        body_roll_id=body.id,
        rib_roll_id=rib.id,
    )

    with pytest.raises(ConflictError):
        await fabric_service.delete_fabric_roll(
            db_session,
            company_id=company.id,
            user_id=user.id,
            roll_id=rib.id,
        )


async def test_delete_fabric_roll_not_found(db_session):
    company, user = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await fabric_service.delete_fabric_roll(
            db_session,
            company_id=company.id,
            user_id=user.id,
            roll_id=uuid.uuid4(),
        )


async def test_delete_fabric_roll_isolated_by_tenant(db_session):
    company_a = await create_company(db_session)
    company_b = await create_company(db_session)
    user_b = await create_user(db_session, company_id=company_b.id)
    seed = await create_fabric_roll(db_session, company_id=company_a.id)

    with pytest.raises(NotFoundError):
        await fabric_service.delete_fabric_roll(
            db_session,
            company_id=company_b.id,
            user_id=user_b.id,
            roll_id=seed.id,
        )


# ---------- _to_read_kwargs ----------


async def test_to_read_kwargs_computes_consumed(db_session):
    company, _ = await _setup(db_session)
    seed = await create_fabric_roll(
        db_session,
        company_id=company.id,
        initial_weight_kg=Decimal("25.000"),
        current_weight_kg=Decimal("18.250"),
    )
    kwargs = fabric_service._to_read_kwargs(seed)
    assert kwargs["consumed_kg"] == Decimal("6.750")
    assert kwargs["initial_weight_kg"] == Decimal("25.000")
    assert kwargs["current_weight_kg"] == Decimal("18.250")
    assert isinstance(kwargs["created_at"], datetime)
    assert kwargs["created_at"].astimezone(UTC) is not None
