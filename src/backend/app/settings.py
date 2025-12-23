import secrets

from pydantic import PostgresDsn, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    @computed_field  # type: ignore[prop-decorator]
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

    # API Config
    API_STR: str = "/api/v1"

    # JWT
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = (
        60 * 60 * 24 * 8  # 60 minutes * 24 hours * 8 days = 8 days
    )


settings = Settings()  # type: ignore
