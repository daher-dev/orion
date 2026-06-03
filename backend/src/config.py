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

    K_SERVICE: str = Field(default="", description="Cloud Run service name")

    ALLOWED_ORIGINS: str = Field(default="", description="Comma-separated list of allowed CORS origins")

    # FEATURE-014 — Anthropic Claude API used by the LLM-powered orders
    # import. Tests never call the real API (mocked via respx). In dev,
    # leave ANTHROPIC_API_KEY blank and the import service surfaces a
    # clear error instead of attempting a request.
    ANTHROPIC_API_KEY: str = Field(default="", description="Anthropic API key (LLM order import)")
    ANTHROPIC_MODEL: str = Field(
        default="claude-haiku-4-5",
        description="Default Anthropic model id (override per-tenant later if needed)",
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
