from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    INSTANCE_URL: str | None = None

    model_config = SettingsConfigDict(env_prefix="CHITHI_")


settings = Settings()
