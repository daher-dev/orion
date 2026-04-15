from fastapi import APIRouter

from routers.healthcheck import router as healthcheck_router

# Aggregate for all /v1/* endpoints. New feature routers get included here.
api_router = APIRouter()

__all__ = ["api_router", "healthcheck_router"]
