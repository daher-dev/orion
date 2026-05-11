from fastapi import APIRouter

from routers.auth import router as auth_router
from routers.clients import router as clients_router
from routers.company import router as company_router
from routers.contractors import router as contractors_router
from routers.fabric import router as fabric_router
from routers.healthcheck import router as healthcheck_router
from routers.invites import router as invites_router
from routers.members import router as members_router
from routers.prints import router as prints_router
from routers.roles import router as roles_router
from routers.specs import router as specs_router
from routers.user import router as user_router

# Aggregate for all /v1/* endpoints. New feature routers get included here.
api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(clients_router)
api_router.include_router(company_router)
api_router.include_router(contractors_router)
api_router.include_router(fabric_router)
api_router.include_router(invites_router)
api_router.include_router(members_router)
api_router.include_router(prints_router)
api_router.include_router(roles_router)
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
    "invites_router",
    "members_router",
    "prints_router",
    "roles_router",
    "specs_router",
    "user_router",
]
