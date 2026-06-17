"""Polyfactory-based factories + small async create helpers used in tests."""

from tests.factories.ad import AdFactory, create_ad
from tests.factories.assembly import AssemblyRunFactory, create_assembly_run
from tests.factories.audit import AuditLogFactory, create_audit_log
from tests.factories.blank_stock import (
    BlankPieceFactory,
    BlankPieceMovementFactory,
    create_blank_piece,
    create_blank_piece_movement,
)
from tests.factories.channel_integration import (
    ChannelConnectionFactory,
    create_channel_connection,
)
from tests.factories.client import ClientFactory, create_client
from tests.factories.company import CompanyFactory, create_company
from tests.factories.cutting import (
    CuttingOrderFactory,
    CuttingOrderOutputFactory,
    create_cutting_order,
    create_cutting_order_output,
)
from tests.factories.fabric import (
    FabricRollFactory,
    FabricRollMovementFactory,
    create_fabric_roll,
    create_fabric_roll_movement,
)
from tests.factories.invite import InviteFactory, create_invite
from tests.factories.order import OrderFactory, create_order
from tests.factories.order_item import OrderItemFactory, create_order_item
from tests.factories.paper_roll import (
    PaperRollFactory,
    PaperRollMovementFactory,
    create_paper_roll,
    create_paper_roll_movement,
)
from tests.factories.plan import (
    PlanFactory,
    SubscriptionFactory,
    create_plan,
    create_subscription,
)
from tests.factories.print_design import (
    PrintDesignFactory,
    PrintDesignVariationFactory,
    create_print_design,
    create_print_design_variation,
)
from tests.factories.print_order import (
    PrintOrderFactory,
    PrintOrderOutputFactory,
    create_print_order,
    create_print_order_output,
)
from tests.factories.printed_transfer import (
    PrintedTransferFactory,
    PrintedTransferMovementFactory,
    create_printed_transfer,
    create_printed_transfer_movement,
)
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
    "AssemblyRunFactory",
    "AuditLogFactory",
    "BlankPieceFactory",
    "BlankPieceMovementFactory",
    "ChannelConnectionFactory",
    "ClientFactory",
    "CompanyFactory",
    "CuttingOrderFactory",
    "CuttingOrderOutputFactory",
    "FabricRollFactory",
    "FabricRollMovementFactory",
    "InviteFactory",
    "OrderFactory",
    "OrderItemFactory",
    "PaperRollFactory",
    "PaperRollMovementFactory",
    "PermissionFactory",
    "PlanFactory",
    "PrintDesignFactory",
    "PrintDesignVariationFactory",
    "PrintOrderFactory",
    "PrintOrderOutputFactory",
    "PrintedTransferFactory",
    "PrintedTransferMovementFactory",
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
    "SubscriptionFactory",
    "UserFactory",
    "create_ad",
    "create_assembly_run",
    "create_audit_log",
    "create_blank_piece",
    "create_blank_piece_movement",
    "create_channel_connection",
    "create_client",
    "create_company",
    "create_cutting_order",
    "create_cutting_order_output",
    "create_fabric_roll",
    "create_fabric_roll_movement",
    "create_invite",
    "create_order",
    "create_order_item",
    "create_paper_roll",
    "create_paper_roll_movement",
    "create_plan",
    "create_print_design",
    "create_print_design_variation",
    "create_print_order",
    "create_print_order_output",
    "create_printed_transfer",
    "create_printed_transfer_movement",
    "create_product",
    "create_product_spec",
    "create_product_variation",
    "create_sewing_contractor",
    "create_sewing_shipment",
    "create_sewing_shipment_item",
    "create_spec_trim",
    "create_stock_entry",
    "create_stock_exit",
    "create_subscription",
    "create_user",
    "get_admin_role",
    "get_role_by_code",
]
