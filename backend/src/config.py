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

    @property
    def is_cloud_run(self) -> bool:
        return bool(self.K_SERVICE)

    @property
    def allowed_origins(self) -> list[str]:
        if self.ENV == "prd":
            # Fill in the production origins for the project.
            return []
        return [
            "http://localhost:3000",
            "http://localhost:8000",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8000",
        ]


config = Settings()
