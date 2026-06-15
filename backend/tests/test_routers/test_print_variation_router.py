"""Router tests for estampa variations + artwork upload.

The artwork upload's storage write is isolated behind
``services.artwork._upload_to_bucket``; tests monkeypatch that single seam so
no Firebase/GCS call happens (and so the upload path is exercised without a
configured bucket).
"""

from httpx import AsyncClient

import services.artwork as artwork_service
from tests.factories import create_company, create_print_design, create_user, get_role_by_code

# A tiny valid PNG (1x1) — header + minimal IDAT.
_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


async def _provision_admin(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    user = await create_user(db_session, company_id=company.id, firebase_uid=firebase_uid)
    return company, user


async def _provision_operator(db_session, firebase_uid: str = "qa-dev-user"):
    company = await create_company(db_session)
    operator_role = await get_role_by_code(db_session, "operator")
    user = await create_user(db_session, company_id=company.id, role_id=operator_role.id, firebase_uid=firebase_uid)
    return company, user


async def test_variation_crud_flow(authed_client: AsyncClient, db_session):
    company, _ = await _provision_admin(db_session)
    design = await create_print_design(db_session, company_id=company.id)

    # Create.
    resp = await authed_client.post(
        f"/v1/prints/{design.id}/variations",
        json={"name": "Branco", "ink_hex": "#f4f1ea"},
    )
    assert resp.status_code == 201, resp.text
    variation = resp.json()
    assert variation["front_status"] == "pending"
    assert variation["back_status"] == "pending"
    variation_id = variation["id"]

    # List.
    resp = await authed_client.get(f"/v1/prints/{design.id}/variations")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # The print detail embeds variations.
    resp = await authed_client.get(f"/v1/prints/{design.id}")
    assert resp.status_code == 200
    assert resp.json()["variations"][0]["id"] == variation_id

    # Patch.
    resp = await authed_client.patch(
        f"/v1/prints/{design.id}/variations/{variation_id}",
        json={"name": "Off-white"},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Off-white"

    # Delete.
    resp = await authed_client.delete(f"/v1/prints/{design.id}/variations/{variation_id}")
    assert resp.status_code == 204

    resp = await authed_client.get(f"/v1/prints/{design.id}/variations")
    assert resp.json() == []


async def test_create_variation_rejects_bad_hex(authed_client: AsyncClient, db_session):
    company, _ = await _provision_admin(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    resp = await authed_client.post(
        f"/v1/prints/{design.id}/variations",
        json={"name": "Bad", "ink_hex": "#ZZZ"},
    )
    assert resp.status_code == 422


async def test_variation_write_forbidden_for_operator(authed_client: AsyncClient, db_session):
    company, _ = await _provision_operator(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    resp = await authed_client.post(
        f"/v1/prints/{design.id}/variations",
        json={"name": "X", "ink_hex": "#000000"},
    )
    assert resp.status_code == 403


async def test_upload_artwork_sets_url_and_status(authed_client: AsyncClient, db_session, monkeypatch):
    company, _ = await _provision_admin(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    resp = await authed_client.post(
        f"/v1/prints/{design.id}/variations",
        json={"name": "Preto", "ink_hex": "#1f1f1f"},
    )
    variation_id = resp.json()["id"]

    captured: dict = {}

    def _fake_upload(*, object_path: str, data: bytes) -> str:
        captured["object_path"] = object_path
        captured["size"] = len(data)
        return f"https://fake-bucket/{object_path}"

    monkeypatch.setattr(artwork_service, "_upload_to_bucket", _fake_upload)

    resp = await authed_client.post(
        f"/v1/prints/{design.id}/variations/{variation_id}/artwork",
        files={"file": ("front.png", _PNG_BYTES, "image/png")},
        data={"side": "front"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["front_status"] == "ok"
    assert body["front_file_url"] == f"https://fake-bucket/{captured['object_path']}"
    assert captured["object_path"].endswith(f"variations/{variation_id}/front.png")
    assert str(company.id) in captured["object_path"]


async def test_upload_artwork_rejects_non_png(authed_client: AsyncClient, db_session, monkeypatch):
    company, _ = await _provision_admin(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    resp = await authed_client.post(
        f"/v1/prints/{design.id}/variations",
        json={"name": "Preto", "ink_hex": "#1f1f1f"},
    )
    variation_id = resp.json()["id"]

    # The seam should never be reached for a non-PNG.
    monkeypatch.setattr(
        artwork_service,
        "_upload_to_bucket",
        lambda **_: (_ for _ in ()).throw(AssertionError("should not upload")),
    )

    resp = await authed_client.post(
        f"/v1/prints/{design.id}/variations/{variation_id}/artwork",
        files={"file": ("art.jpg", b"\xff\xd8\xff\xe0jpeg-bytes", "image/jpeg")},
        data={"side": "front"},
    )
    assert resp.status_code == 422


async def test_upload_artwork_rejects_empty_file(authed_client: AsyncClient, db_session):
    company, _ = await _provision_admin(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    resp = await authed_client.post(
        f"/v1/prints/{design.id}/variations",
        json={"name": "Preto", "ink_hex": "#1f1f1f"},
    )
    variation_id = resp.json()["id"]

    resp = await authed_client.post(
        f"/v1/prints/{design.id}/variations/{variation_id}/artwork",
        files={"file": ("front.png", b"", "image/png")},
        data={"side": "front"},
    )
    assert resp.status_code == 400


async def test_upload_artwork_unknown_variation_404(authed_client: AsyncClient, db_session):
    import uuid

    company, _ = await _provision_admin(db_session)
    design = await create_print_design(db_session, company_id=company.id)
    resp = await authed_client.post(
        f"/v1/prints/{design.id}/variations/{uuid.uuid4()}/artwork",
        files={"file": ("front.png", _PNG_BYTES, "image/png")},
        data={"side": "front"},
    )
    assert resp.status_code == 404
