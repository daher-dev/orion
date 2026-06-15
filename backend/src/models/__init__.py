"""SQLModel table definitions.

Every new table model file must be imported here so Alembic's autogenerate
picks it up via `SQLModel.metadata`.
"""

from models.ad import Ad
from models.ad_products import AdProduct
from models.audit_log import AuditLog
from models.base import BaseModel, CompanyModel
from models.batch import Batch
from models.channel_integration import ChannelConnection
from models.client import Client
from models.company import Company
from models.company_settings import CompanySettings
from models.cutting_order import CuttingOrder, CuttingOrderOutput
from models.cutting_run_cost import CuttingRunCost
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
    PrintStockDirection,
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
from models.fabric_roll import FabricRoll
from models.imported_order import ImportedOrder
from models.invite import Invite
from models.login_attempt import LoginAttempt
from models.order import Order
from models.order_item import OrderItem
from models.plan import Plan
from models.print_design import PrintDesign, PrintDesignVariation
from models.print_stock import PrintStockMovement
from models.product import Product, ProductVariation
from models.product_spec import ProductSpec, SpecTrim
from models.role import Permission, Role, RolePermission
from models.sewing_contractor import SewingContractor
from models.sewing_shipment import SewingShipment, SewingShipmentItem
from models.stock import StockEntry, StockExit
from models.subscription import Subscription
from models.supply import Supply, SupplyMovement
from models.user import User

__all__ = [
    "Ad",
    "AdProduct",
    "ArtworkStatus",
    "AuditLog",
    "BaseModel",
    "Batch",
    "BatchStatus",
    "BlankMovementKind",
    "ChannelConnection",
    "ChannelStatus",
    "Client",
    "Company",
    "CompanyModel",
    "CompanySettings",
    "CuttingOrder",
    "CuttingOrderOutput",
    "CuttingRunCost",
    "CuttingStatus",
    "Ecommerce",
    "FabricRoll",
    "FabricRollKind",
    "FabricType",
    "ImportedOrder",
    "Invite",
    "LoginAttempt",
    "LoginOutcome",
    "Order",
    "OrderItem",
    "OrderStatus",
    "PaperMovementKind",
    "PaperType",
    "Permission",
    "Plan",
    "PrintDesign",
    "PrintDesignVariation",
    "PrintOrderStatus",
    "PrintSide",
    "PrintStockDirection",
    "PrintStockMovement",
    "PrintTechnique",
    "PrintedMovementKind",
    "Product",
    "ProductSpec",
    "ProductType",
    "ProductVariation",
    "Role",
    "RolePermission",
    "SeparationStatus",
    "SewingContractor",
    "SewingShipment",
    "SewingShipmentItem",
    "ShipmentStatus",
    "Size",
    "SpecTrim",
    "StockEntry",
    "StockExit",
    "StockExitReason",
    "StockSource",
    "Subscription",
    "SubscriptionStatus",
    "Supply",
    "SupplyMovement",
    "SupplyMovementKind",
    "TrimType",
    "User",
]
