"""SQLModel table definitions.

Every new table model file must be imported here so Alembic's autogenerate
picks it up via `SQLModel.metadata`.
"""

from models.ad import Ad
from models.audit_log import AuditLog
from models.base import BaseModel, CompanyModel
from models.client import Client
from models.company import Company
from models.cutting_order import CuttingOrder, CuttingOrderOutput
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
from models.fabric_roll import FabricRoll
from models.invite import Invite
from models.order import Order
from models.print_design import PrintDesign
from models.product import Product, ProductVariation
from models.product_spec import ProductSpec, SpecTrim
from models.role import Permission, Role, RolePermission
from models.sewing_contractor import SewingContractor
from models.sewing_shipment import SewingShipment, SewingShipmentItem
from models.stock import StockEntry, StockExit
from models.user import User

__all__ = [
    "Ad",
    "AuditLog",
    "BaseModel",
    "Client",
    "Company",
    "CompanyModel",
    "CuttingOrder",
    "CuttingOrderOutput",
    "CuttingStatus",
    "Ecommerce",
    "FabricRoll",
    "FabricRollKind",
    "FabricType",
    "Invite",
    "Order",
    "OrderStatus",
    "Permission",
    "PrintDesign",
    "Product",
    "ProductSpec",
    "ProductType",
    "ProductVariation",
    "Role",
    "RolePermission",
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
    "TrimType",
    "User",
]
