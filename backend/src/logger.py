import json
import logging
from typing import ClassVar

from config import config


class JsonFormatter(logging.Formatter):
    STANDARD_ATTRS: ClassVar[set[str]] = {
        "name",
        "msg",
        "args",
        "created",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "module",
        "msecs",
        "message",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "thread",
        "threadName",
        "exc_info",
        "exc_text",
        "stack_info",
        "taskName",
    }

    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "severity": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "timestamp": self.formatTime(record, self.datefmt),
        }
        if record.exc_info:
            log_obj["exc_info"] = self.formatException(record.exc_info)
        for key, value in record.__dict__.items():
            if key not in self.STANDARD_ATTRS and not key.startswith("_"):
                log_obj[key] = value
        return json.dumps(log_obj)


def get_logger(name: str | None = None) -> logging.Logger:
    return logging.getLogger(name) if name else logging.getLogger()


def setup_logging() -> None:
    log_level = getattr(logging, config.LOG_LEVEL.upper(), logging.INFO)
    json_formatter = JsonFormatter()

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers.clear()

    handler = logging.StreamHandler()
    handler.setFormatter(json_formatter)
    root_logger.addHandler(handler)

    for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access", "uvicorn.asgi"]:
        uvicorn_logger = logging.getLogger(logger_name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.addHandler(handler)
        uvicorn_logger.propagate = False
        uvicorn_logger.setLevel(log_level)
