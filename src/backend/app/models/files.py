from sqlmodel import SQLModel, Field
from sqlalchemy import text, Column, DateTime, func
from datetime import datetime
from uuid import UUID


class File(SQLModel, table=True):
    id: UUID = Field(
        primary_key=True,
        sa_column_kwargs={"server_default": text("uuidv7()")},
    )
    filename: str

    # Control expiry
    expires_at: datetime
    expire_after_n_download: int

    # Tracking downloads
    download_count: int = 0
    created_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        )
    )
