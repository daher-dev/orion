"""Unit tests for the stock service layer.

Coverage targets
----------------
- `list_stock_levels` — aggregation, filters (q / product_id / low_stock_only),
  tenant isolation, empty-ledger exclusion, pagination, ordering.
- `list_movements` — interleaving + ordering, filters (variation / date /
  type / reason_or_source), tenant isolation, pagination.
- `create_entry` — happy path, audit log, defaults.
- `create_exit` — happy path, audit log, **negative-stock guard**, tenant
  isolation.
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlmodel import select

from models import AuditLog, StockEntry, StockExit, StockExitReason, StockSource
from schemas._common import PageParams
from schemas.stock import (
    MovementsFilters,
    StockEntryCreate,
    StockExitCreate,
    StockFilters,
)
from services import stock as stock_service
from shared.exceptions import ConflictError, NotFoundError
from tests.factories import (
    create_company,
    create_product,
    create_product_spec,
    create_product_variation,
    create_stock_entry,
    create_stock_exit,
    create_user,
)

# ---------- fixtures ----------


async def _setup(db_session):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id)
    return company, user


async def _make_variation(db_session, *, company_id: uuid.UUID, **overrides):
    # Use a unique spec code so the (company_id, spec_id, print_id) unique
    # constraint on `products` doesn't collide when callers create multiple
    # variations in the same test.
    spec = await create_product_spec(
        db_session, company_id=company_id, code=f"FT{uuid.uuid4().hex[:6].upper()}"
    )
    product = await create_product(db_session, company_id=company_id, spec_id=spec.id)
    variation = await create_product_variation(
        db_session,
        company_id=company_id,
        product_id=product.id,
        **overrides,
    )
    return product, variation


async def _audits_for(db_session, *, resource_id: uuid.UUID) -> list[AuditLog]:
    result = await db_session.exec(
        select(AuditLog).where(AuditLog.resource_id == resource_id),
    )
    return list(result.all())


# ---------- create_entry ----------


async def test_create_entry_happy_path(db_session):
    company, user = await _setup(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)

    entry = await stock_service.create_entry(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=StockEntryCreate(
            variation_id=variation.id,
            quantity=20,
            source=StockSource.ADJUSTMENT,
            notes="Found in warehouse",
        ),
    )

    assert entry.id is not None
    assert entry.company_id == company.id
    assert entry.variation_id == variation.id
    assert entry.quantity == 20
    assert entry.source == StockSource.ADJUSTMENT
    assert entry.notes == "Found in warehouse"
    assert entry.shipment_id is None

    audits = await _audits_for(db_session, resource_id=entry.id)
    assert any("Adjusted stock for SKU" in a.message for a in audits)
    assert any("+20" in a.message for a in audits)


async def test_create_entry_strips_whitespace_in_notes(db_session):
    company, user = await _setup(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    entry = await stock_service.create_entry(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=StockEntryCreate(
            variation_id=variation.id,
            quantity=5,
            notes="  padded  ",
        ),
    )
    assert entry.notes == "padded"


async def test_create_entry_handles_none_notes(db_session):
    company, user = await _setup(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    entry = await stock_service.create_entry(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=StockEntryCreate(
            variation_id=variation.id,
            quantity=2,
        ),
    )
    assert entry.notes is None


async def test_create_entry_rejects_unknown_variation(db_session):
    company, user = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await stock_service.create_entry(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=StockEntryCreate(
                variation_id=uuid.uuid4(),
                quantity=5,
            ),
        )


async def test_create_entry_rejects_other_tenant_variation(db_session):
    company_a, user_a = await _setup(db_session)
    company_b = await create_company(db_session)
    _, foreign_variation = await _make_variation(db_session, company_id=company_b.id)

    with pytest.raises(NotFoundError):
        await stock_service.create_entry(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            payload=StockEntryCreate(
                variation_id=foreign_variation.id,
                quantity=5,
            ),
        )


# ---------- create_exit ----------


async def test_create_exit_happy_path(db_session):
    company, user = await _setup(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    # Seed an entry so we can take some out.
    await create_stock_entry(db_session, company_id=company.id, variation_id=variation.id, quantity=10)

    exit_row = await stock_service.create_exit(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=StockExitCreate(
            variation_id=variation.id,
            quantity=3,
            reason=StockExitReason.ADJUSTMENT,
        ),
    )

    assert exit_row.quantity == 3
    assert exit_row.reason == StockExitReason.ADJUSTMENT
    audits = await _audits_for(db_session, resource_id=exit_row.id)
    assert any("-3" in a.message for a in audits)


async def test_create_exit_blocks_negative_stock(db_session):
    company, user = await _setup(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=variation.id, quantity=2)

    with pytest.raises(ConflictError) as exc:
        await stock_service.create_exit(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=StockExitCreate(variation_id=variation.id, quantity=5),
        )
    assert "insufficient" in str(exc.value.detail).lower()
    assert "2" in str(exc.value.detail)

    # The exit must NOT have been written.
    rows = (await db_session.exec(select(StockExit).where(StockExit.variation_id == variation.id))).all()
    assert list(rows) == []


async def test_create_exit_blocks_when_no_entries_at_all(db_session):
    """Even a virgin variation can't go negative."""
    company, user = await _setup(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    with pytest.raises(ConflictError):
        await stock_service.create_exit(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=StockExitCreate(variation_id=variation.id, quantity=1),
        )


async def test_create_exit_allows_taking_exactly_what_is_available(db_session):
    company, user = await _setup(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=variation.id, quantity=4)

    exit_row = await stock_service.create_exit(
        db_session,
        company_id=company.id,
        user_id=user.id,
        payload=StockExitCreate(variation_id=variation.id, quantity=4),
    )
    assert exit_row.quantity == 4

    on_hand = await stock_service._compute_on_hand(
        db_session, company_id=company.id, variation_id=variation.id
    )
    assert on_hand == 0


async def test_create_exit_rejects_unknown_variation(db_session):
    company, user = await _setup(db_session)
    with pytest.raises(NotFoundError):
        await stock_service.create_exit(
            db_session,
            company_id=company.id,
            user_id=user.id,
            payload=StockExitCreate(variation_id=uuid.uuid4(), quantity=1),
        )


async def test_create_exit_isolated_by_tenant(db_session):
    company_a, user_a = await _setup(db_session)
    company_b = await create_company(db_session)
    _, foreign = await _make_variation(db_session, company_id=company_b.id)
    await create_stock_entry(
        db_session, company_id=company_b.id, variation_id=foreign.id, quantity=10
    )

    # Company A cannot exit from company B's variation.
    with pytest.raises(NotFoundError):
        await stock_service.create_exit(
            db_session,
            company_id=company_a.id,
            user_id=user_a.id,
            payload=StockExitCreate(variation_id=foreign.id, quantity=1),
        )


# ---------- list_stock_levels ----------


async def test_list_stock_levels_aggregates_entries_minus_exits(db_session):
    company, _ = await _setup(db_session)
    _, variation = await _make_variation(
        db_session, company_id=company.id, sku="CAM01-M-BLK"
    )
    await create_stock_entry(
        db_session, company_id=company.id, variation_id=variation.id, quantity=10
    )
    await create_stock_entry(
        db_session, company_id=company.id, variation_id=variation.id, quantity=5
    )
    await create_stock_exit(
        db_session, company_id=company.id, variation_id=variation.id, quantity=3
    )

    rows, total = await stock_service.list_stock_levels(
        db_session,
        company_id=company.id,
        filters=StockFilters(),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0]["sku"] == "CAM01-M-BLK"
    assert rows[0]["on_hand"] == 12
    assert rows[0]["entries_total"] == 15
    assert rows[0]["exits_total"] == 3
    assert rows[0]["last_movement_at"] is not None
    assert rows[0]["product"]["name"]


async def test_list_stock_levels_excludes_variations_with_no_ledger(db_session):
    """A variation with NO entries AND NO exits must not appear."""
    company, _ = await _setup(db_session)
    await _make_variation(db_session, company_id=company.id, sku="EMPTY-M-BLK")

    rows, total = await stock_service.list_stock_levels(
        db_session,
        company_id=company.id,
        filters=StockFilters(),
        page=PageParams(),
    )
    assert total == 0
    assert rows == []


async def test_list_stock_levels_includes_variation_with_only_exits(db_session):
    """Edge: if a variation has a manual exit but no entries, it still appears."""
    company, _ = await _setup(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id, sku="EXIT-ONLY")
    # Direct insert bypassing the service so we don't trip the negative-stock guard.
    await create_stock_exit(
        db_session, company_id=company.id, variation_id=variation.id, quantity=4
    )

    rows, total = await stock_service.list_stock_levels(
        db_session,
        company_id=company.id,
        filters=StockFilters(),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0]["on_hand"] == -4
    assert rows[0]["exits_total"] == 4
    assert rows[0]["entries_total"] == 0


async def test_list_stock_levels_filters_by_low_stock_only(db_session):
    company, _ = await _setup(db_session)
    _, low = await _make_variation(db_session, company_id=company.id, sku="LOW-M-BLK")
    _, high = await _make_variation(db_session, company_id=company.id, sku="HIGH-M-BLK")

    await create_stock_entry(
        db_session, company_id=company.id, variation_id=low.id, quantity=3
    )
    await create_stock_entry(
        db_session, company_id=company.id, variation_id=high.id, quantity=50
    )

    rows, total = await stock_service.list_stock_levels(
        db_session,
        company_id=company.id,
        filters=StockFilters(low_stock_only=True, threshold=5),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0]["sku"] == "LOW-M-BLK"


async def test_list_stock_levels_filters_by_product_id(db_session):
    company, _ = await _setup(db_session)
    spec_a = await create_product_spec(db_session, company_id=company.id, code="SPEC-A")
    spec_b = await create_product_spec(db_session, company_id=company.id, code="SPEC-B")
    product_a = await create_product(db_session, company_id=company.id, spec_id=spec_a.id)
    product_b = await create_product(db_session, company_id=company.id, spec_id=spec_b.id)
    var_a = await create_product_variation(
        db_session,
        company_id=company.id,
        product_id=product_a.id,
        sku="A-M-BLK",
        color_code="BLK",
    )
    var_b = await create_product_variation(
        db_session,
        company_id=company.id,
        product_id=product_b.id,
        sku="B-M-BLK",
        color_code="BLK",
    )
    await create_stock_entry(db_session, company_id=company.id, variation_id=var_a.id, quantity=1)
    await create_stock_entry(db_session, company_id=company.id, variation_id=var_b.id, quantity=1)

    rows, total = await stock_service.list_stock_levels(
        db_session,
        company_id=company.id,
        filters=StockFilters(product_id=product_a.id),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0]["sku"] == "A-M-BLK"


async def test_list_stock_levels_search_matches_sku(db_session):
    company, _ = await _setup(db_session)
    _, v1 = await _make_variation(
        db_session, company_id=company.id, sku="MUG-001-M-BLK"
    )
    _, v2 = await _make_variation(
        db_session, company_id=company.id, sku="OTHER-M-BLK"
    )
    await create_stock_entry(db_session, company_id=company.id, variation_id=v1.id, quantity=1)
    await create_stock_entry(db_session, company_id=company.id, variation_id=v2.id, quantity=1)

    rows, total = await stock_service.list_stock_levels(
        db_session,
        company_id=company.id,
        filters=StockFilters(q="mug"),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0]["sku"] == "MUG-001-M-BLK"


async def test_list_stock_levels_search_matches_color(db_session):
    company, _ = await _setup(db_session)
    _, v1 = await _make_variation(
        db_session, company_id=company.id, color="Preto", color_code="BLK"
    )
    _, v2 = await _make_variation(
        db_session, company_id=company.id, color="Off-white", color_code="OFW"
    )
    await create_stock_entry(db_session, company_id=company.id, variation_id=v1.id, quantity=1)
    await create_stock_entry(db_session, company_id=company.id, variation_id=v2.id, quantity=1)

    rows, total = await stock_service.list_stock_levels(
        db_session,
        company_id=company.id,
        filters=StockFilters(q="off-white"),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0]["color"] == "Off-white"


async def test_list_stock_levels_search_matches_product_name(db_session):
    company, _ = await _setup(db_session)
    spec = await create_product_spec(db_session, company_id=company.id)
    product = await create_product(
        db_session, company_id=company.id, spec_id=spec.id, name="Camisa Bordada"
    )
    variation = await create_product_variation(
        db_session, company_id=company.id, product_id=product.id
    )
    await create_stock_entry(
        db_session, company_id=company.id, variation_id=variation.id, quantity=2
    )

    _rows, total = await stock_service.list_stock_levels(
        db_session,
        company_id=company.id,
        filters=StockFilters(q="bordada"),
        page=PageParams(),
    )
    assert total == 1


async def test_list_stock_levels_isolated_by_tenant(db_session):
    company_a, _ = await _setup(db_session)
    company_b = await create_company(db_session)
    _, va = await _make_variation(db_session, company_id=company_a.id, sku="A-M-BLK")
    _, vb = await _make_variation(db_session, company_id=company_b.id, sku="B-M-BLK")
    await create_stock_entry(db_session, company_id=company_a.id, variation_id=va.id, quantity=1)
    await create_stock_entry(db_session, company_id=company_b.id, variation_id=vb.id, quantity=1)

    rows, total = await stock_service.list_stock_levels(
        db_session,
        company_id=company_a.id,
        filters=StockFilters(),
        page=PageParams(),
    )
    assert total == 1
    assert rows[0]["sku"] == "A-M-BLK"


async def test_list_stock_levels_pagination(db_session):
    company, _ = await _setup(db_session)
    skus = ["A-M-BLK", "B-M-BLK", "C-M-BLK", "D-M-BLK"]
    for sku in skus:
        _, v = await _make_variation(db_session, company_id=company.id, sku=sku)
        await create_stock_entry(db_session, company_id=company.id, variation_id=v.id, quantity=1)

    rows, total = await stock_service.list_stock_levels(
        db_session,
        company_id=company.id,
        filters=StockFilters(),
        page=PageParams(page=1, page_size=2),
    )
    assert total == 4
    assert len(rows) == 2
    # Sorted by SKU asc — page 1 holds A and B.
    assert [r["sku"] for r in rows] == ["A-M-BLK", "B-M-BLK"]


# ---------- list_movements ----------


async def test_list_movements_interleaves_entries_and_exits(db_session):
    company, _ = await _setup(db_session)
    _, variation = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=variation.id, quantity=10)
    await create_stock_exit(db_session, company_id=company.id, variation_id=variation.id, quantity=3)

    items, total = await stock_service.list_movements(
        db_session,
        company_id=company.id,
        filters=MovementsFilters(),
        page=PageParams(),
    )
    assert total == 2
    types = sorted(m.type for m in items)
    assert types == ["entry", "exit"]


async def test_list_movements_orders_desc_by_created_at(db_session):
    company, _ = await _setup(db_session)
    _, v = await _make_variation(db_session, company_id=company.id)
    e1 = await create_stock_entry(db_session, company_id=company.id, variation_id=v.id, quantity=1)
    e2 = await create_stock_entry(db_session, company_id=company.id, variation_id=v.id, quantity=2)
    e3 = await create_stock_entry(db_session, company_id=company.id, variation_id=v.id, quantity=3)
    items, total = await stock_service.list_movements(
        db_session,
        company_id=company.id,
        filters=MovementsFilters(),
        page=PageParams(),
    )
    assert total == 3
    # Most recent first — e3 has the latest created_at.
    assert items[0].id == e3.id
    assert items[-1].id == e1.id
    _ = e2  # used by created_at progression


async def test_list_movements_filters_by_variation_id(db_session):
    company, _ = await _setup(db_session)
    _, v1 = await _make_variation(db_session, company_id=company.id, sku="ONE-M-BLK")
    _, v2 = await _make_variation(db_session, company_id=company.id, sku="TWO-M-BLK")
    await create_stock_entry(db_session, company_id=company.id, variation_id=v1.id, quantity=1)
    await create_stock_entry(db_session, company_id=company.id, variation_id=v2.id, quantity=2)
    items, total = await stock_service.list_movements(
        db_session,
        company_id=company.id,
        filters=MovementsFilters(variation_id=v1.id),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].variation_id == v1.id


async def test_list_movements_filters_by_type_entry(db_session):
    company, _ = await _setup(db_session)
    _, v = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=v.id, quantity=5)
    await create_stock_exit(db_session, company_id=company.id, variation_id=v.id, quantity=2)
    items, total = await stock_service.list_movements(
        db_session,
        company_id=company.id,
        filters=MovementsFilters(type="entry"),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].type == "entry"


async def test_list_movements_filters_by_type_exit(db_session):
    company, _ = await _setup(db_session)
    _, v = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=v.id, quantity=5)
    await create_stock_exit(db_session, company_id=company.id, variation_id=v.id, quantity=2)
    items, total = await stock_service.list_movements(
        db_session,
        company_id=company.id,
        filters=MovementsFilters(type="exit"),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].type == "exit"


async def test_list_movements_filters_by_reason_or_source(db_session):
    company, _ = await _setup(db_session)
    _, v = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(
        db_session,
        company_id=company.id,
        variation_id=v.id,
        quantity=4,
        source=StockSource.SHIPMENT,
    )
    await create_stock_entry(
        db_session,
        company_id=company.id,
        variation_id=v.id,
        quantity=2,
        source=StockSource.ADJUSTMENT,
    )
    items, total = await stock_service.list_movements(
        db_session,
        company_id=company.id,
        filters=MovementsFilters(reason_or_source="shipment"),
        page=PageParams(),
    )
    # Only the shipment-sourced entry matches; the exits side filter compares to
    # `reason` and matches nothing.
    assert total == 1
    assert items[0].type == "entry"


async def test_list_movements_filters_by_date_range(db_session):
    company, _ = await _setup(db_session)
    _, v = await _make_variation(db_session, company_id=company.id)
    await create_stock_entry(db_session, company_id=company.id, variation_id=v.id, quantity=1)

    today = date.today()
    _items, total = await stock_service.list_movements(
        db_session,
        company_id=company.id,
        filters=MovementsFilters(
            date_from=today - timedelta(days=1),
            date_to=today + timedelta(days=1),
        ),
        page=PageParams(),
    )
    assert total == 1

    _items, total = await stock_service.list_movements(
        db_session,
        company_id=company.id,
        filters=MovementsFilters(date_from=today + timedelta(days=2)),
        page=PageParams(),
    )
    assert total == 0


async def test_list_movements_pagination(db_session):
    company, _ = await _setup(db_session)
    _, v = await _make_variation(db_session, company_id=company.id)
    for _ in range(5):
        await create_stock_entry(db_session, company_id=company.id, variation_id=v.id, quantity=1)

    items, total = await stock_service.list_movements(
        db_session,
        company_id=company.id,
        filters=MovementsFilters(),
        page=PageParams(page=1, page_size=2),
    )
    assert total == 5
    assert len(items) == 2


async def test_list_movements_tenant_isolation(db_session):
    company_a, _ = await _setup(db_session)
    company_b = await create_company(db_session)
    _, va = await _make_variation(db_session, company_id=company_a.id)
    _, vb = await _make_variation(db_session, company_id=company_b.id)
    await create_stock_entry(db_session, company_id=company_a.id, variation_id=va.id, quantity=1)
    await create_stock_entry(db_session, company_id=company_b.id, variation_id=vb.id, quantity=1)

    items, total = await stock_service.list_movements(
        db_session,
        company_id=company_a.id,
        filters=MovementsFilters(),
        page=PageParams(),
    )
    assert total == 1
    assert items[0].variation_id == va.id


# Pin polyfactory imports so flake8/ruff don't strip them when the file gets refactored.
_ = (Decimal, StockEntry)
