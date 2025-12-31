from datetime import timedelta
from uuid import UUID

from pydantic import model_validator
from sqlalchemy import BigInteger, Connection, Integer, String, event, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapper
from sqlmodel import Column, Field, SQLModel

from app.converter.bytes import ByteSize


class ConfigIn(SQLModel):
    # Max limits
    total_storage_limit: int = Field(
        default=ByteSize(gb=10).total_bytes(), sa_column=Column(BigInteger)
    )
    max_file_size_limit: int = Field(
        default=ByteSize(mb=100).total_bytes(), sa_column=Column(BigInteger)
    )

    # Default constraints
    default_expiry: int = int(timedelta(days=7).total_seconds())
    default_number_of_downloads: int = 10

    # Markdown fields
    site_description: str = "Welcome to Chithi"

    # Customizable fields
    download_configs: list[int] = Field(
        default=[10],
        sa_column=Column(ARRAY(Integer)),
    )
    time_configs: list[int] = Field(
        default=[int(timedelta(days=7).total_seconds())],
        sa_column=Column(ARRAY(Integer)),
    )

    allowed_file_types: list[str] = Field(default=[], sa_column=Column(ARRAY(String)))
    banned_file_types: list[str] = Field(default=[], sa_column=Column(ARRAY(String)))

    @model_validator(mode="after")
    def sync_defaults(self) -> ConfigIn:
        if self.default_number_of_downloads not in self.download_configs:
            raise ValueError(
                "Conflict: default_number_of_downloads must be one of the values in download_configs"
            )

        if self.default_expiry not in self.time_configs:
            raise ValueError(
                "Conflict: default_expiry must be one of the values in time_configs"
            )
        return self

    @model_validator(mode="after")
    def validate_file_types_consistency(self) -> "ConfigIn":
        if set(self.allowed_file_types) & set(self.banned_file_types):
            raise ValueError(
                "Conflict: allowed_file_types and banned_file_types cannot share common extensions"
            )
        return self


class Config(ConfigIn, table=True):
    id: UUID = Field(
        default=None,
        primary_key=True,
        sa_column_kwargs={
            "server_default": text(
                "uuidv7()",
            )
        },
    )


@event.listens_for(Config, "before_insert")
def enforce_singleton(mapper: Mapper, connection: Connection, target: Config):
    result = connection.execute(text("SELECT 1 FROM config LIMIT 1"))
    if result.fetchone() is not None:
        raise ValueError("Only one row is allowed in config")


@event.listens_for(Config, "before_delete")
def prevent_config_deletion(mapper: Mapper, connection: Connection, target: Config):
    raise ValueError("The configuration record cannot be deleted")
