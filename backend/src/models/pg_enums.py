"""Shared PG_ENUM instances.

When the same enum value-set is referenced by multiple tables, defining
a single PG_ENUM instance here and reusing it prevents Alembic from
emitting duplicate CREATE TYPE statements.
"""

from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM

from models.enums import (
    ArtworkStatus,
    BatchStatus,
    BlankMovementKind,
    ChannelStatus,
    CuttingStatus,
    Ecommerce,
    FabricRollKind,
    FabricType,
    LoginOutcome,
    OrderStatus,
    PaperMovementKind,
    PaperType,
    PrintedMovementKind,
    PrintOrderStatus,
    PrintSide,
    PrintTechnique,
    ProductType,
    SeparationStatus,
    ShipmentStatus,
    Size,
    StockExitReason,
    StockSource,
    SubscriptionStatus,
    SupplyMovementKind,
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
LOGIN_OUTCOME = _enum(LoginOutcome, "login_outcome")
BATCH_STATUS = _enum(BatchStatus, "batch_status")
CHANNEL_STATUS = _enum(ChannelStatus, "channel_status")
SEPARATION_STATUS = _enum(SeparationStatus, "separation_status")
PRINT_TECHNIQUE = _enum(PrintTechnique, "print_technique")
SUPPLY_MOVEMENT_KIND = _enum(SupplyMovementKind, "supply_movement_kind")
SUBSCRIPTION_STATUS = _enum(SubscriptionStatus, "subscription_status")
PAPER_TYPE = _enum(PaperType, "paper_type")
PRINT_SIDE = _enum(PrintSide, "print_side")
PRINT_ORDER_STATUS = _enum(PrintOrderStatus, "print_order_status")
ARTWORK_STATUS = _enum(ArtworkStatus, "artwork_status")
BLANK_MOVEMENT_KIND = _enum(BlankMovementKind, "blank_movement_kind")
PAPER_MOVEMENT_KIND = _enum(PaperMovementKind, "paper_movement_kind")
PRINTED_MOVEMENT_KIND = _enum(PrintedMovementKind, "printed_movement_kind")
