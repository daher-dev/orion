"""HTTP layer for reading data out of the base44 REST API.

The endpoint shape, params and auth here were confirmed against the published
``@base44/sdk`` (v0.8.30):

    GET {server}/api/apps/{appId}/entities/{Entity}
        params: sort, limit, skip, fields
        headers: api_key: <token>, X-App-Id: <appId>

    (The SDK uses ``Authorization: Bearer`` for user JWTs; server-to-server
    API keys go in the ``api_key`` header — verified against the live API.)

The SDK's axios layer unwraps ``response.data``, so the list endpoint returns
the records. We stay tolerant of the exact envelope (plain array, or an object
keyed by ``data`` / ``items`` / ``records`` / ``results``).

Pagination is offset based (``limit`` + ``skip``); base44 caps a page at ~5000
rows. We loop until a short page comes back, de-duplicating by ``id`` so a
record created mid-extraction can't sneak in twice.
"""

from __future__ import annotations

import asyncio
from typing import Any

import httpx

# base44 caps a single list() page; stay a little under it.
DEFAULT_PAGE_SIZE = 1000
MAX_PAGE_SIZE = 5000
# Safety net so a misbehaving endpoint can't spin forever.
_MAX_PAGES = 10_000
_MAX_RETRIES = 5
# A stable sort key keeps offset pagination consistent across pages. Every
# base44 record carries the system field ``created_date``.
_STABLE_SORT = "created_date"


class Base44Error(RuntimeError):
    """Raised when the base44 API returns an error we can't recover from."""


class Base44Client:
    """Thin async reader for one base44 app's entities."""

    def __init__(
        self,
        *,
        server_url: str,
        app_id: str,
        token: str,
        timeout: float = 60.0,
    ) -> None:
        if not app_id:
            raise Base44Error("BASE44_APP_ID is not set")
        if not token:
            raise Base44Error("BASE44_API_TOKEN is not set")
        self._app_id = app_id
        base_url = f"{server_url.rstrip('/')}/api"
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
            headers={
                # Server-to-server API keys authenticate via the `api_key`
                # header (verified against the live API). The SDK's
                # `Authorization: Bearer` is for user JWTs and 403s with a key.
                "api_key": token,
                "X-App-Id": app_id,
                "Accept": "application/json",
            },
        )

    async def __aenter__(self) -> Base44Client:
        return self

    async def __aexit__(self, *_exc: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._client.aclose()

    def _entity_path(self, entity: str) -> str:
        return f"/apps/{self._app_id}/entities/{entity}"

    async def _get(self, path: str, params: dict[str, Any]) -> Any:
        """GET with retry/backoff on 429 and transient 5xx."""
        delay = 1.0
        last_exc: Exception | None = None
        for _attempt in range(_MAX_RETRIES):
            try:
                resp = await self._client.get(path, params=params)
            except httpx.TransportError as exc:  # network blip
                last_exc = exc
                await asyncio.sleep(delay)
                delay *= 2
                continue
            if resp.status_code == 429 or resp.status_code >= 500:
                retry_after = resp.headers.get("Retry-After")
                wait = float(retry_after) if retry_after and retry_after.isdigit() else delay
                await asyncio.sleep(wait)
                delay *= 2
                continue
            if resp.status_code >= 400:
                raise Base44Error(f"GET {path} → {resp.status_code}: {resp.text[:500]}")
            return resp.json()
        raise Base44Error(f"GET {path} failed after {_MAX_RETRIES} retries: {last_exc}")

    @staticmethod
    def _unwrap(payload: Any) -> list[dict]:
        """Coerce whatever the list endpoint returned into a list of records."""
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict):
            for key in ("data", "items", "records", "results"):
                value = payload.get(key)
                if isinstance(value, list):
                    return value
            # A single-object response (rare) — treat as one record.
            if "id" in payload:
                return [payload]
        raise Base44Error(f"Unexpected list payload shape: {type(payload).__name__}")

    async def sample(self, entity: str, *, limit: int = 25) -> list[dict]:
        """Fetch the first page of an entity for schema discovery."""
        payload = await self._get(
            self._entity_path(entity),
            {"limit": limit, "sort": _STABLE_SORT},
        )
        return self._unwrap(payload)

    async def list_records(
        self,
        entity: str,
        *,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> list[dict]:
        """Fetch every record of an entity via offset pagination."""
        page_size = min(page_size, MAX_PAGE_SIZE)
        out: list[dict] = []
        seen: set[str] = set()
        skip = 0
        for _ in range(_MAX_PAGES):
            payload = await self._get(
                self._entity_path(entity),
                {"limit": page_size, "skip": skip, "sort": _STABLE_SORT},
            )
            page = self._unwrap(payload)
            if not page:
                break
            new_in_page = 0
            for record in page:
                rid = record.get("id")
                key = str(rid) if rid is not None else None
                if key is not None and key in seen:
                    continue
                if key is not None:
                    seen.add(key)
                out.append(record)
                new_in_page += 1
            if len(page) < page_size or new_in_page == 0:
                break
            skip += page_size
        return out
