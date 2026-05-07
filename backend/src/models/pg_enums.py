"""Shared PG_ENUM instances.

When the same enum value-set is referenced by multiple tables, defining
a single PG_ENUM instance here and reusing it prevents Alembic from
emitting duplicate CREATE TYPE statements.
"""

from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM

from models.enums import (
    CuttingStatus,
    Ecommerce,
    FabricRollKind,
    FabricType,
    OrderStatus,
    ProductType,
    ShipmentStatus,
    Size,
    StockExitReason,
    StockSource,
    TrimType,
)


def _enum(py_enum, name: str) -> PG_ENUM:
    return PG_ENUM(
        py_enum,
        name=name,
        create_type=True,
        values_callable=lambda e: [m.value for m in e],
    )


PRODUCT_TYPE = _enum(ProductType, "product_type")
SIZE = _enum(Size, "size")
FABRIC_TYPE = _enum(FabricType, "fabric_type")
FABRIC_ROLL_KIND = _enum(FabricRollKind, "fabric_roll_kind")
TRIM_TYPE = _enum(TrimType, "trim_type")
ECOMMERCE = _enum(Ecommerce, "ecommerce")
CUTTING_STATUS = _enum(CuttingStatus, "cutting_status")
SHIPMENT_STATUS = _enum(ShipmentStatus, "shipment_status")
STOCK_SOURCE = _enum(StockSource, "stock_source")
STOCK_EXIT_REASON = _enum(StockExitReason, "stock_exit_reason")
ORDER_STATUS = _enum(OrderStatus, "order_status")
