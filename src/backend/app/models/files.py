from datetime import datetime, timezone
from typing import Self
from uuid import UUID

from pydantic import model_validator
from sqlalchemy import BigInteger, Column, DateTime, UniqueConstraint, event, text
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Mapper
from sqlmodel import Field, SQLModel

class FilesWithStats(SQLModel):
    files: list[FileInformationOut]
    total_urls: int
    total_size: int
    links_with_download_caps: int
    max_expires_at: datetime | None
    longest_expiry_file: FileInformationOut | None


class FileInformationOut(SQLModel):
    id: UUID
    filename: str
    size: int

    download_count: int
    created_at: datetime

    expires_at: datetime
    expire_after_n_download: int




class FileOut(SQLModel):
    # Unique Identifier for the S3 storage
    key: str = Field()


class File(FileOut, table=True):
    id: UUID = Field(
        default=None,
        primary_key=True,
        sa_column_kwargs={"server_default": text("uuidv7()")},
    )
    filename: str = Field()

    # Control expiry
    expires_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    expire_after_n_download: int = Field(sa_column=Column(BigInteger()))

    # Tracking downloads
    download_count: int = Field(default=0, sa_column=Column(BigInteger()))
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )

    size: int = Field(sa_column=Column(BigInteger()))

    __table_args__ = (UniqueConstraint("id", "key"),)

    @property
    def is_expired(self) -> bool:
        now = datetime.now(timezone.utc)
        return (
            now > self.expires_at or self.download_count >= self.expire_after_n_download
        )

    @model_validator(mode="after")
    def validate_expire(self) -> Self:
        if self.expires_at < self.created_at:
            raise ValueError("Expiration time cannot be earlier than creation time")
        return self


@event.listens_for(File, "after_delete")
def on_file_delete(mapper: Mapper, connection: Connection, target: File):
    """
    Event hook to evict the file from the global app state (Redis) after it is deleted from the DB.
    This ensures that total_space_used is updated and the file is removed from active_uploads.
    """
    import asyncio

    from app.states.app import AppState

    # Capture values to avoid issues with target being detached/deleted
    file_key = target.key
    file_size = target.size

    async def do_evict():
        await AppState.evict_files(file_keys=[file_key], freed_bytes=file_size)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(do_evict())
    except RuntimeError:
        # If no loop is running, we might be in a sync context.
        # In this app, it's expected to have a loop in FastAPI or Celery async tasks.
        pass
