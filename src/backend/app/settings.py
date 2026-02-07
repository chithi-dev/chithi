import secrets
from typing import Literal

from pydantic import PostgresDsn, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.converter.bytes import ByteSize

LOG_TYPES = Literal["warning", "info", "critical", "error", "debug"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Use top level .env file (one level above ./backend/)
        env_file="../.env",
        env_ignore_empty=True,
        extra="ignore",
    )

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "supersecretpassword"
    POSTGRES_DB: str = "chithi"

    # --- SQLite Fields ---
    USE_SQLITE: bool = False
    SQLITE_DB: str = "sql_app.db"

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn | str:
        if self.USE_SQLITE:
            # SQLite uses 3 slashes for a relative path: sqlite:///./filename.db
            return f"sqlite:///./{self.SQLITE_DB}"

        return PostgresDsn.build(
            scheme="postgresql+asyncpg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )

    # JWT
    SECRET_KEY: str = secrets.token_urlsafe(32)

    ACCESS_TOKEN_EXPIRE_MINUTES: int = (
        60 * 60 * 24 * 8  # 60 minutes * 24 hours * 8 days = 8 days
    )
    # RustFS
    RUSTFS_ENDPOINT_URL: str = "http://localhost:9000"
    RUSTFS_ACCESS_KEY: str = "rustfsadmin"
    RUSTFS_SECRET_ACCESS_KEY: str = "rustfsadmin"
    RUSTFS_BUCKET_NAME: str = "chithi"

    # Celery Backend
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    # Reverse Proxy
    ROOT_PATH: str = ""

    # Redis

    REDIS_ENDPOINT: str = "redis://localhost:6379/1"

    # Speedtest

    MAX_DOWNLOAD_SIZE: int = ByteSize(gb=30).total_bytes()


settings = Settings()  # type: ignore
