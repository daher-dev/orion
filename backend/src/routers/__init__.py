from fastapi import APIRouter

from routers.auth import router as auth_router
from routers.clients import router as clients_router
from routers.contractors import router as contractors_router
from routers.healthcheck import router as healthcheck_router
from routers.specs import router as specs_router

# Aggregate for all /v1/* endpoints. New feature routers get included here.
api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(clients_router)
api_router.include_router(contractors_router)
api_router.include_router(specs_router)

__all__ = [
    "api_router",
    "auth_router",
    "clients_router",
    "contractors_router",
    "healthcheck_router",
    "specs_router",
]
