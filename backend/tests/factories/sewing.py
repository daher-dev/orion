import uuid
from datetime import UTC, datetime

from polyfactory import Use
from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import (
    SewingContractor,
    SewingShipment,
    SewingShipmentItem,
    ShipmentStatus,
    Size,
)


class SewingContractorFactory(ModelFactory[SewingContractor]):
    __model__ = SewingContractor
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True


class SewingShipmentFactory(ModelFactory[SewingShipment]):
    __model__ = SewingShipment
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    status = ShipmentStatus.SENT
    sent_at = Use(lambda: datetime.now(UTC).date())
    received_at = None


class SewingShipmentItemFactory(ModelFactory[SewingShipmentItem]):
    __model__ = SewingShipmentItem
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    size = Size.M
    requested_quantity = 10
    received_quantity = 0


async def create_sewing_contractor(db: AsyncSession, *, company_id: uuid.UUID, **overrides) -> SewingContractor:
    contractor = SewingContractorFactory.build(company_id=company_id, **overrides)
    db.add(contractor)
    await db.commit()
    await db.refresh(contractor)
    return contractor


async def create_sewing_shipment(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    cutting_order_id: uuid.UUID,
    contractor_id: uuid.UUID,
    **overrides,
) -> SewingShipment:
    shipment = SewingShipmentFactory.build(
        company_id=company_id,
        cutting_order_id=cutting_order_id,
        contractor_id=contractor_id,
        **overrides,
    )
    db.add(shipment)
    await db.commit()
    await db.refresh(shipment)
    return shipment


async def create_sewing_shipment_item(
    db: AsyncSession,
    *,
    shipment_id: uuid.UUID,
    **overrides,
) -> SewingShipmentItem:
    item = SewingShipmentItemFactory.build(shipment_id=shipment_id, **overrides)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item
