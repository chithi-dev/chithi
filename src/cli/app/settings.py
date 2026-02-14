from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    INSTANCE_URL: str | None = None
    EXPIRE_AFTER_N_DOWNLOAD: int | None = None
    EXPIRE_AFTER: int | None = None

    model_config = SettingsConfigDict(env_prefix="CHITHI_")


settings = Settings()
