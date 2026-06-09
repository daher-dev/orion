from fastapi import APIRouter

from routers.admin import router as admin_router
from routers.ads import router as ads_router
from routers.audit_log import router as audit_log_router
from routers.auth import router as auth_router
from routers.batches import router as batches_router
from routers.billing import router as billing_router
from routers.channel_integration import router as channel_integration_router
from routers.clients import router as clients_router
from routers.company import router as company_router
from routers.contractors import router as contractors_router
from routers.cutting import router as cutting_router
from routers.dashboard import router as dashboard_router
from routers.fabric import router as fabric_router
from routers.healthcheck import router as healthcheck_router
from routers.invites import router as invites_router
from routers.mapping import router as mapping_router
from routers.members import router as members_router
from routers.orders import router as orders_router
from routers.orders_import import router as orders_import_router
from routers.print_stock import router as print_stock_router
from routers.prints import router as prints_router
from routers.products import router as products_router
from routers.reports import router as reports_router
from routers.roles import router as roles_router
from routers.sewing import router as sewing_router
from routers.specs import router as specs_router
from routers.stock import router as stock_router
from routers.supplies import router as supplies_router
from routers.user import router as user_router

# Aggregate for all /v1/* endpoints. New feature routers get included here.
api_router = APIRouter()
api_router.include_router(admin_router)
api_router.include_router(ads_router)
api_router.include_router(audit_log_router)
api_router.include_router(auth_router)
api_router.include_router(batches_router)
api_router.include_router(billing_router)
api_router.include_router(channel_integration_router)
api_router.include_router(clients_router)
api_router.include_router(company_router)
api_router.include_router(contractors_router)
api_router.include_router(cutting_router)
api_router.include_router(dashboard_router)
api_router.include_router(fabric_router)
api_router.include_router(invites_router)
api_router.include_router(mapping_router)
api_router.include_router(members_router)
api_router.include_router(orders_router)
api_router.include_router(orders_import_router)
api_router.include_router(print_stock_router)
api_router.include_router(prints_router)
api_router.include_router(products_router)
api_router.include_router(reports_router)
api_router.include_router(roles_router)
api_router.include_router(sewing_router)
api_router.include_router(specs_router)
api_router.include_router(stock_router)
api_router.include_router(supplies_router)
api_router.include_router(user_router)

__all__ = [
    "admin_router",
    "ads_router",
    "api_router",
    "audit_log_router",
    "auth_router",
    "batches_router",
    "billing_router",
    "channel_integration_router",
    "clients_router",
    "company_router",
    "contractors_router",
    "cutting_router",
    "dashboard_router",
    "fabric_router",
    "healthcheck_router",
    "invites_router",
    "mapping_router",
    "members_router",
    "orders_import_router",
    "orders_router",
    "print_stock_router",
    "prints_router",
    "products_router",
    "reports_router",
    "roles_router",
    "sewing_router",
    "specs_router",
    "stock_router",
    "supplies_router",
    "user_router",
]
