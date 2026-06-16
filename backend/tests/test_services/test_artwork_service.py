"""Unit tests for the artwork upload helper (storage seam + guards)."""

import uuid

import pytest

import services.artwork as artwork_service
from services.artwork import upload_artwork
from shared.exceptions import ValidationError

_IDS = {
    "company_id": uuid.uuid4(),
    "print_id": uuid.uuid4(),
    "variation_id": uuid.uuid4(),
}


def test_upload_artwork_returns_seam_url(monkeypatch):
    monkeypatch.setattr(
        artwork_service,
        "_upload_to_bucket",
        lambda *, object_path, data: f"https://bucket/{object_path}",
    )
    url = upload_artwork(
        **_IDS,
        side="front",
        data=b"png-bytes",
        content_type="image/png",
        filename="front.png",
    )
    assert url.endswith("front.png")
    assert str(_IDS["company_id"]) in url


def test_upload_artwork_object_path_is_company_scoped(monkeypatch):
    captured: dict = {}
    monkeypatch.setattr(
        artwork_service,
        "_upload_to_bucket",
        lambda *, object_path, data: captured.setdefault("p", object_path) or "x",
    )
    upload_artwork(**_IDS, side="back", data=b"x", content_type="image/png", filename=None)
    expected = f"companies/{_IDS['company_id']}/prints/{_IDS['print_id']}/variations/{_IDS['variation_id']}/back.png"
    assert captured["p"] == expected


def test_upload_artwork_rejects_non_png():
    with pytest.raises(ValidationError):
        upload_artwork(**_IDS, side="front", data=b"x", content_type="image/jpeg", filename="x.jpg")


def test_upload_artwork_rejects_empty():
    with pytest.raises(ValidationError):
        upload_artwork(**_IDS, side="front", data=b"", content_type="image/png", filename="x.png")


def test_upload_artwork_rejects_oversize():
    big = b"\x00" * (5 * 1024 * 1024 + 1)
    with pytest.raises(ValidationError):
        upload_artwork(**_IDS, side="front", data=big, content_type="image/png", filename="x.png")


def test_upload_artwork_accepts_png_content_type_with_charset(monkeypatch):
    monkeypatch.setattr(artwork_service, "_upload_to_bucket", lambda *, object_path, data: "ok")
    url = upload_artwork(
        **_IDS,
        side="front",
        data=b"png",
        content_type="image/png; charset=binary",
        filename="x.png",
    )
    assert url == "ok"


def test_upload_to_bucket_local_fallback_without_bucket(monkeypatch):
    """With no configured bucket, the real seam returns a deterministic local URL."""

    monkeypatch.setattr(artwork_service.config, "FIREBASE_STORAGE_BUCKET", "", raising=False)
    url = artwork_service._upload_to_bucket(object_path="companies/x/y.png", data=b"data")
    assert url == "local://artwork/companies/x/y.png"
