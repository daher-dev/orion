"""Channel provider adapters (generic + Mercado Livre).

Design
------
- ``build_auth_url`` is a PURE string builder — no network, always safe to call.
- ``exchange_code`` and ``fetch_orders`` are GUARDED by the per-channel
  ``enabled`` flag (driven by config). When disabled (the default, and always
  in tests) they return deterministic stub values and perform NO network I/O.
- ``httpx`` is imported lazily inside the guarded branches so the dependency is
  never touched at import time when a provider is disabled.

Security: tokens returned here flow into ``ChannelConnection`` plaintext columns
for this scaffold. They are placeholders in stub mode; real tokens must be
encrypted before any production rollout.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

from config import config
from models.enums import Ecommerce


@dataclass(frozen=True)
class TokenBundle:
    """Result of an OAuth code exchange."""

    access_token: str
    refresh_token: str | None = None
    expires_at: datetime | None = None
    external_account_id: str | None = None
    scopes: str | None = None


@dataclass(frozen=True)
class ChannelProvider:
    """A marketplace OAuth/order-feed adapter.

    The base implementation is a fully-functional STUB used by every channel
    that has no dedicated subclass (and by Mercado Livre when its flag is off).
    """

    channel: Ecommerce
    enabled: bool = False
    authorize_endpoint: str = "https://auth.example.com/authorization"
    client_id: str = ""
    redirect_uri: str = ""
    default_scopes: tuple[str, ...] = field(default_factory=tuple)

    def build_auth_url(self, *, state: str) -> str:
        """Pure deterministic authorization URL. Never performs network I/O."""
        params = {
            "response_type": "code",
            "client_id": self.client_id or f"stub-{self.channel.value}",
            "redirect_uri": self.redirect_uri,
            "state": state,
        }
        if self.default_scopes:
            params["scope"] = " ".join(self.default_scopes)
        return f"{self.authorize_endpoint}?{urlencode(params)}"

    async def exchange_code(self, *, code: str | None) -> TokenBundle:
        """Exchange an OAuth code for tokens.

        Stub mode (``enabled`` False) returns placeholder tokens with no I/O.
        """
        if not self.enabled or config.ENV != "prd":
            return self._stub_tokens(code=code)
        return await self._exchange_code_live(code=code)  # pragma: no cover

    async def fetch_orders(self, *, access_token: str | None) -> list[dict]:
        """Fetch recent orders from the channel.

        Stub mode returns an empty list and performs no network I/O.
        """
        if not self.enabled or config.ENV != "prd":
            return []
        return await self._fetch_orders_live(access_token=access_token)  # pragma: no cover

    # ----- stub helpers -----

    def _stub_tokens(self, *, code: str | None) -> TokenBundle:
        suffix = (code or "stub")[:12]
        return TokenBundle(
            access_token=f"stub-access-{self.channel.value}-{suffix}",
            refresh_token=f"stub-refresh-{self.channel.value}",
            expires_at=datetime.now(UTC) + timedelta(hours=6),
            external_account_id=f"stub-acct-{uuid.uuid4().hex[:8]}",
            scopes=" ".join(self.default_scopes) if self.default_scopes else None,
        )

    # ----- live implementations (only reached when enabled AND ENV==prd) -----

    async def _exchange_code_live(self, *, code: str | None) -> TokenBundle:  # pragma: no cover
        raise NotImplementedError("Live OAuth not implemented for the generic provider")

    async def _fetch_orders_live(self, *, access_token: str | None) -> list[dict]:  # pragma: no cover
        raise NotImplementedError("Live order fetch not implemented for the generic provider")


@dataclass(frozen=True)
class MercadoLivreProvider(ChannelProvider):
    """Mercado Livre OAuth adapter.

    ``build_auth_url`` is pure. The token exchange / order fetch hit the real
    ML API only when ``CHANNEL_ML_ENABLED`` is true and ENV is ``prd`` — never
    in dev or tests.
    """

    authorize_endpoint: str = "https://auth.mercadolivre.com.br/authorization"
    token_endpoint: str = "https://api.mercadolibre.com/oauth/token"
    orders_endpoint: str = "https://api.mercadolibre.com/orders/search"

    async def _exchange_code_live(self, *, code: str | None) -> TokenBundle:  # pragma: no cover
        import httpx  # lazy: only imported when the real flow runs

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                self.token_endpoint,
                data={
                    "grant_type": "authorization_code",
                    "client_id": config.CHANNEL_ML_CLIENT_ID,
                    "client_secret": config.CHANNEL_ML_CLIENT_SECRET,
                    "code": code or "",
                    "redirect_uri": self.redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
        expires_at = None
        if data.get("expires_in"):
            expires_at = datetime.now(UTC) + timedelta(seconds=int(data["expires_in"]))
        return TokenBundle(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            expires_at=expires_at,
            external_account_id=str(data["user_id"]) if data.get("user_id") else None,
            scopes=data.get("scope"),
        )

    async def _fetch_orders_live(self, *, access_token: str | None) -> list[dict]:  # pragma: no cover
        import httpx  # lazy

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                self.orders_endpoint,
                params={"access_token": access_token},
                headers={"Accept": "application/json"},
            )
            resp.raise_for_status()
            return resp.json().get("results", [])


def get_provider(channel: Ecommerce) -> ChannelProvider:
    """Resolve the provider adapter for a channel.

    Mercado Livre gets its dedicated adapter (config-driven). Every other
    supported channel uses the generic stub provider — sufficient for the
    scaffold and guaranteed network-free.
    """
    if channel is Ecommerce.MERCADO_LIVRE:
        return MercadoLivreProvider(
            channel=channel,
            enabled=config.CHANNEL_ML_ENABLED,
            client_id=config.CHANNEL_ML_CLIENT_ID,
            redirect_uri=config.CHANNEL_ML_REDIRECT_URI,
            default_scopes=("read", "offline_access"),
        )
    return ChannelProvider(channel=channel, enabled=False)


__all__ = ["ChannelProvider", "MercadoLivreProvider", "TokenBundle", "get_provider"]
