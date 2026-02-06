from datetime import timedelta
from uuid import UUID

from sqlalchemy import Connection, FromClause, event
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapper
from sqlmodel import BigInteger, Column, Field, Integer, SQLModel, String, select, text

from app.converter.bytes import ByteSize


class ConfigUpdate(SQLModel):
    total_storage_limit: int | None = None
    max_file_size_limit: int | None = None
    default_expiry: int | None = None
    default_number_of_downloads: int | None = None
    site_description: str | None = None
    download_configs: list[int] | None = None
    time_configs: list[int] | None = None
    allowed_file_types: list[str] | None = None
    banned_file_types: list[str] | None = None


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
    site_description: str = Field(
        default="## Configurable File Sharing\n\nWelcome to your Chithi instance. It allows you to share file with a link that automatically expires. So you know what you are sharing is always private and doesn't stay on internet forever."
    )

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


@event.listens_for(Config, "before_update")
def validate_config_update(mapper: Mapper, connection: Connection, target: Config):
    # ensure the expiry is one of the available time options
    if target.default_expiry not in target.time_configs:
        raise ValueError(
            f"Conflict: {target.default_expiry} must be one of the values in {target.time_configs}"
        )


@event.listens_for(Config, "before_update")
def validate_number_of_downloads(
    mapper: Mapper, connection: Connection, target: Config
):
    if target.default_number_of_downloads not in target.download_configs:
        raise ValueError(
            "Conflict: default_number_of_downloads must be one of the values in download_configs"
        )


@event.listens_for(Config, "before_update")
def validate_file_types_consistency(
    mapper: Mapper, connection: Connection, target: Config
):
    if set(target.allowed_file_types) & set(target.banned_file_types):
        raise ValueError(
            "Conflict: allowed_file_types and banned_file_types cannot share common extensions"
        )


@event.listens_for(Config, "before_insert")
def enforce_singleton[T](mapper: Mapper[T], connection: Connection, target: T) -> None:
    table: FromClause = mapper.local_table

    stmt = select(1).select_from(table).limit(1)

    result = connection.execute(stmt).fetchone()
    table_name = getattr(table, "name", "unknown_table")

    if result is not None:
        raise ValueError(f"Only one row is allowed in the '{table_name}' table.")


@event.listens_for(Config, "before_delete")
def prevent_config_deletion(mapper: Mapper, connection: Connection, target: Config):
    raise ValueError("The configuration record cannot be deleted")
