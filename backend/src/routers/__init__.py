from fastapi import APIRouter

from routers.auth import router as auth_router
from routers.clients import router as clients_router
from routers.company import router as company_router
from routers.contractors import router as contractors_router
from routers.fabric import router as fabric_router
from routers.healthcheck import router as healthcheck_router
from routers.prints import router as prints_router
from routers.products import router as products_router
from routers.specs import router as specs_router
from routers.user import router as user_router

# Aggregate for all /v1/* endpoints. New feature routers get included here.
api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(clients_router)
api_router.include_router(company_router)
api_router.include_router(contractors_router)
api_router.include_router(fabric_router)
api_router.include_router(prints_router)
api_router.include_router(products_router)
api_router.include_router(specs_router)
api_router.include_router(user_router)

__all__ = [
    "api_router",
    "auth_router",
    "clients_router",
    "company_router",
    "contractors_router",
    "fabric_router",
    "healthcheck_router",
    "prints_router",
    "products_router",
    "specs_router",
    "user_router",
]
