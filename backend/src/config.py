from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
    )

    APP_NAME: str = "orion-api"
    ENV: str = "dev"
    LOG_LEVEL: str = "DEBUG"
    DATABASE_URL: str = Field(default="", description="PostgreSQL connection string")

    FIREBASE_PROJECT_ID: str = Field(default="", description="Firebase project ID for Admin SDK")
    FIREBASE_STORAGE_BUCKET: str = Field(default="", description="GCS bucket for artwork uploads")

    K_SERVICE: str = Field(default="", description="Cloud Run service name")

    ALLOWED_ORIGINS: str = Field(default="", description="Comma-separated list of allowed CORS origins")

    # Marketplace channel integrations (FEATURE — channel integration).
    # Real OAuth + order-feed calls to external marketplaces are GUARDED behind
    # these flags. They default to disabled/blank so the running app — and every
    # test — operates in "stub" mode: connect produces a deterministic auth URL,
    # the callback stores placeholder tokens, and no network I/O is performed.
    # Set CHANNEL_ML_ENABLED=true plus the client credentials to wire the real
    # Mercado Livre flow (httpx is imported lazily inside the provider so the
    # dependency is never pulled at import time when disabled).
    CHANNEL_ML_ENABLED: bool = Field(
        default=False,
        description="Enable real Mercado Livre OAuth/order-feed calls (else stub mode)",
    )
    CHANNEL_ML_CLIENT_ID: str = Field(default="", description="Mercado Livre app client id")
    CHANNEL_ML_CLIENT_SECRET: str = Field(default="", description="Mercado Livre app client secret")
    CHANNEL_ML_REDIRECT_URI: str = Field(
        default="http://localhost:8000/v1/integrations/channels/mercado_livre/callback",
        description="OAuth redirect URI registered with the Mercado Livre app",
    )

    # base44 → Orion data migration. Only the importer scripts under
    # `backend/scripts/base44/` read these; the running app ignores them.
    # Leave blank everywhere except where the migration is actually run.
    BASE44_API_URL: str = Field(
        default="https://base44.app",
        description="base44 server URL; the REST base is this + '/api'",
    )
    BASE44_APP_ID: str = Field(default="", description="base44 application id of the legacy app")
    BASE44_API_TOKEN: str = Field(
        default="",
        description="base44 bearer token used to read entity data (sent as 'Authorization: Bearer …')",
    )
    BASE44_TARGET_SUBDOMAIN: str = Field(
        default="",
        description="Subdomain of the Orion company the base44 data is imported into",
    )

    @property
    def is_cloud_run(self) -> bool:
        return bool(self.K_SERVICE)

    @property
    def allowed_origins(self) -> list[str]:
        configured = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        if self.ENV == "prd":
            return configured
        return [
            *configured,
            "http://localhost:3000",
            "http://localhost:8000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8000",
        ]


config = Settings()
