"""Artwork (estampa variation PNG) upload helper.

Uploads a variation's per-side PNG to Firebase/GCS Storage and returns the
stored object's public URL. The actual bucket write is isolated in
:func:`_upload_to_bucket` so tests can monkeypatch a single seam without
touching ``firebase-admin``; when no bucket is configured (dev/test) a
deterministic local fallback URL is returned instead of raising.

Guards (content-type PNG-only, 5 MB max) are enforced here; the router applies
the same empty/size guards on the raw upload before calling in (matching
``routers/orders_import.py``).
"""

from __future__ import annotations

import uuid

from config import config
from logger import get_logger
from shared.exceptions import ValidationError

logger = get_logger(__name__)

_MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB, mirrors routers/orders_import.py
_ALLOWED_CONTENT_TYPE = "image/png"


def _object_path(*, company_id: uuid.UUID, print_id: uuid.UUID, variation_id: uuid.UUID, side: str) -> str:
    return f"companies/{company_id}/prints/{print_id}/variations/{variation_id}/{side}.png"


def _upload_to_bucket(*, object_path: str, data: bytes) -> str:
    """Write ``data`` to the configured GCS bucket and return its public URL.

    This is the single seam tests monkeypatch. When no bucket is configured the
    upload is skipped and a deterministic local URL is returned so dev/test
    flows work without Firebase Storage.
    """

    bucket_name = config.FIREBASE_STORAGE_BUCKET
    if not bucket_name:
        logger.warning("FIREBASE_STORAGE_BUCKET not set; returning local fallback URL for %s", object_path)
        return f"local://artwork/{object_path}"

    # Imported lazily so the dependency (and bucket init) is only touched when a
    # real upload happens — keeps tests/dev without a bucket import-clean.
    from firebase_admin import storage

    bucket = storage.bucket(bucket_name)
    blob = bucket.blob(object_path)
    blob.upload_from_string(data, content_type=_ALLOWED_CONTENT_TYPE)
    blob.make_public()
    return blob.public_url


def upload_artwork(
    *,
    company_id: uuid.UUID,
    print_id: uuid.UUID,
    variation_id: uuid.UUID,
    side: str,
    data: bytes,
    content_type: str | None,
    filename: str | None = None,
) -> str:
    """Validate + upload a per-side artwork PNG, returning its stored URL."""

    _ = filename  # accepted for parity with the upload contract; not used in the path
    if content_type is not None and content_type.split(";", 1)[0].strip().lower() != _ALLOWED_CONTENT_TYPE:
        raise ValidationError(detail="Artwork must be a PNG image (image/png)")
    if not data:
        raise ValidationError(detail="Uploaded file is empty")
    if len(data) > _MAX_UPLOAD_BYTES:
        raise ValidationError(detail="Upload exceeds 5MB limit")

    object_path = _object_path(
        company_id=company_id,
        print_id=print_id,
        variation_id=variation_id,
        side=side,
    )
    return _upload_to_bucket(object_path=object_path, data=data)


__all__ = ["upload_artwork"]
