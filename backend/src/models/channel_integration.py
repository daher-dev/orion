from datetime import datetime

from sqlalchemy import DateTime, UniqueConstraint
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import ChannelStatus, Ecommerce
from models.pg_enums import CHANNEL_STATUS, ECOMMERCE


class ChannelConnection(CompanyModel, table=True):
    """A tenant's connection to a single marketplace/sales channel.

    One row per (company, channel). Supported channels that have never been
    connected are NOT persisted — they are surfaced as synthetic ``available``
    entries by the service merging this table with the channel catalog. A row
    exists only once the tenant has started/completed an OAuth-style connect.

    Security note: ``access_token`` / ``refresh_token`` are stored as plain
    nullable columns for this scaffold. Before enabling any real OAuth flow in
    production these MUST be encrypted at rest (or moved to a secret manager) —
    they are never exposed by the read schema returned to the browser.
    """

    __tablename__ = "channel_connections"
    __table_args__ = (UniqueConstraint("company_id", "channel", name="uq_channel_connections_company_id_channel"),)

    channel: Ecommerce = Field(sa_type=ECOMMERCE)
    status: ChannelStatus = Field(default=ChannelStatus.AVAILABLE, sa_type=CHANNEL_STATUS)

    access_token: str | None = Field(default=None, max_length=2048)
    refresh_token: str | None = Field(default=None, max_length=2048)
    token_expires_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    last_sync_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    external_account_id: str | None = Field(default=None, max_length=255)
    scopes: str | None = Field(default=None, max_length=1024)
