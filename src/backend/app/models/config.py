from sqlmodel import SQLModel, Field
from sqlalchemy import text
from uuid import UUID


class Config(SQLModel, table=True):
    id: UUID = Field(
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
