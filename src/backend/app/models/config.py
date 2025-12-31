from datetime import timedelta
from uuid import UUID

from sqlalchemy import BigInteger, Integer, String, text
from sqlalchemy.dialects.postgresql import ARRAY
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
