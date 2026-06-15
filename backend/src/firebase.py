"""Firebase Admin SDK initialization for token verification."""

from typing import Any

import firebase_admin
from firebase_admin import credentials

from config import config
from logger import get_logger

logger = get_logger(__name__)


def init_firebase() -> None:
    """Initialize Firebase Admin SDK using Application Default Credentials.

    Skips silently if no credentials are available — dev environments using the
    dev-bypass header do not need Firebase. Production must have ADC configured.
    """
    if firebase_admin._apps:
        return

    options: dict[str, Any] = {}
    if config.FIREBASE_PROJECT_ID:
        options["projectId"] = config.FIREBASE_PROJECT_ID
    if config.FIREBASE_STORAGE_BUCKET:
        options["storageBucket"] = config.FIREBASE_STORAGE_BUCKET

    try:
        creds = credentials.ApplicationDefault()
        firebase_admin.initialize_app(credential=creds, options=options)
    except Exception as exc:
        if config.ENV == "prd":
            raise
        logger.warning(
            "Firebase Admin SDK not initialized: %s. Dev bypass auth remains available.",
            exc,
        )
