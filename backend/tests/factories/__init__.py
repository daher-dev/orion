"""Polyfactory-based factories + small async create helpers used in tests."""

from tests.factories.ad import AdFactory, create_ad
from tests.factories.audit import AuditLogFactory, create_audit_log
from tests.factories.client import ClientFactory, create_client
from tests.factories.company import CompanyFactory, create_company
from tests.factories.cutting import (
    CuttingOrderFactory,
    CuttingOrderOutputFactory,
    create_cutting_order,
    create_cutting_order_output,
)
from tests.factories.fabric import FabricRollFactory, create_fabric_roll
from tests.factories.invite import InviteFactory, create_invite
from tests.factories.order import OrderFactory, create_order
from tests.factories.print_design import PrintDesignFactory, create_print_design
from tests.factories.product import (
    ProductFactory,
    ProductVariationFactory,
    create_product,
    create_product_variation,
)
from tests.factories.product_spec import (
    ProductSpecFactory,
    SpecTrimFactory,
    create_product_spec,
    create_spec_trim,
)
from tests.factories.role import (
    PermissionFactory,
    RoleFactory,
    get_admin_role,
    get_role_by_code,
)
from tests.factories.sewing import (
    SewingContractorFactory,
    SewingShipmentFactory,
    SewingShipmentItemFactory,
    create_sewing_contractor,
    create_sewing_shipment,
    create_sewing_shipment_item,
)
from tests.factories.stock import (
    StockEntryFactory,
    StockExitFactory,
    create_stock_entry,
    create_stock_exit,
)
from tests.factories.user import UserFactory, create_user

__all__ = [
    "AdFactory",
    "AuditLogFactory",
    "ClientFactory",
    "CompanyFactory",
    "CuttingOrderFactory",
    "CuttingOrderOutputFactory",
    "FabricRollFactory",
    "InviteFactory",
    "OrderFactory",
    "PermissionFactory",
    "PrintDesignFactory",
    "ProductFactory",
    "ProductSpecFactory",
    "ProductVariationFactory",
    "RoleFactory",
    "SewingContractorFactory",
    "SewingShipmentFactory",
    "SewingShipmentItemFactory",
    "SpecTrimFactory",
    "StockEntryFactory",
    "StockExitFactory",
    "UserFactory",
    "create_ad",
    "create_audit_log",
    "create_client",
    "create_company",
    "create_cutting_order",
    "create_cutting_order_output",
    "create_fabric_roll",
    "create_invite",
    "create_order",
    "create_print_design",
    "create_product",
    "create_product_spec",
    "create_product_variation",
    "create_sewing_contractor",
    "create_sewing_shipment",
    "create_sewing_shipment_item",
    "create_spec_trim",
    "create_stock_entry",
    "create_stock_exit",
    "create_user",
    "get_admin_role",
    "get_role_by_code",
]
