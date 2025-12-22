from sqlmodel import SQLModel, Field, Column
from sqlalchemy import text
from uuid import UUID
from datetime import datetime
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy import Integer, String, Date


class Config(SQLModel, table=True):
    id: UUID = Field(
        default=None,
        primary_key=True,
        sa_column_kwargs={
            "server_default": text(
                "uuidv7()",
            )
        },
    )

    # Max limits
    total_storage_limit_gb: int = 10
    max_file_size_mb: int = 100

    # Default constraints
    default_expiry_days: int = 7
    default_number_of_downloads: int = 5

    # Markdown fields
    site_description: str = "Welcome to Chithi"

    # Customizable fields
    download_configs: list[int] = Field(default=[], sa_column=Column(ARRAY(Integer)))
    time_configs: list[datetime] = Field(default=[], sa_column=Column(ARRAY(Date)))

    allowed_file_types: list[str] = Field(default=[], sa_column=Column(ARRAY(String)))
    banned_file_types: list[str] = Field(default=[], sa_column=Column(ARRAY(String)))
