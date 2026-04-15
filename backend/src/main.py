import json
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError
from pydantic_core import ValidationError as PydanticCoreValidationError

from config import config
from firebase import init_firebase
from logger import get_logger, setup_logging
from routers import api_router, healthcheck_router
from shared.exceptions import BaseAPIException

logger = get_logger(__name__)


def _serialize_validation_error(error: dict) -> dict:
    serializable_error = {
        "type": error.get("type"),
        "loc": error.get("loc", []),
        "msg": error.get("msg", ""),
        "input": str(error.get("input", ""))[:200] if error.get("input") is not None else None,
    }
    ctx = error.get("ctx")
    if ctx:
        serialized_ctx = {}
        for key, value in ctx.items():
            try:
                json.dumps(value)
                serialized_ctx[key] = value
            except TypeError, ValueError:
                serialized_ctx[key] = str(value)
        serializable_error["ctx"] = serialized_ctx
    return serializable_error


def create_app() -> FastAPI:
    init_firebase()

    app = FastAPI(
        title="Orion API",
        description="Orion backend API",
        version="0.1.0",
    )

    if config.is_cloud_run:
        setup_logging()
    else:
        log_level = getattr(logging, config.LOG_LEVEL.upper(), logging.INFO)
        logging.basicConfig(level=log_level)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        errors = [_serialize_validation_error(error) for error in exc.errors()]
        return JSONResponse(
            status_code=422,
            content={"error": True, "detail": "Invalid input data", "validation_errors": errors},
        )

    @app.exception_handler(PydanticValidationError)
    async def handle_pydantic_validation_error(request: Request, exc: PydanticValidationError):
        errors = [_serialize_validation_error(error) for error in exc.errors()]
        return JSONResponse(
            status_code=422,
            content={"error": True, "detail": "Invalid input data", "validation_errors": errors},
        )

    @app.exception_handler(PydanticCoreValidationError)
    async def handle_pydantic_core_validation_error(request: Request, exc: PydanticCoreValidationError):
        errors = [_serialize_validation_error(error) for error in exc.errors()]
        return JSONResponse(
            status_code=422,
            content={"error": True, "detail": "Invalid input data", "validation_errors": errors},
        )

    @app.exception_handler(BaseAPIException)
    async def handle_base_api_exception(request: Request, exc: BaseAPIException):
        return JSONResponse(status_code=exc.status_code, content={"error": True, "detail": exc.detail})

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception):
        logger.exception("Unhandled exception", extra={"path": str(request.url.path), "method": request.method})
        return JSONResponse(status_code=500, content={"error": True, "detail": "Internal server error"})

    app.include_router(healthcheck_router, prefix="")
    app.include_router(api_router, prefix="/v1")

    return app


app = create_app()
