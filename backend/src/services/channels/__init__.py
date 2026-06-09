"""Channel provider adapters.

Isolates all external-marketplace knowledge (auth URLs, token exchange, order
fetch) behind a small provider interface so the integration service stays
network-agnostic and testable. Real HTTP is guarded by config flags — when a
provider is disabled it returns deterministic stub values and performs no I/O.
"""

from services.channels.providers import (
    ChannelProvider,
    MercadoLivreProvider,
    TokenBundle,
    get_provider,
)

__all__ = ["ChannelProvider", "MercadoLivreProvider", "TokenBundle", "get_provider"]
