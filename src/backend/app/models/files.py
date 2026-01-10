from datetime import datetime, timezone
from typing import Self
from uuid import UUID

from pydantic import model_validator
from sqlalchemy import UniqueConstraint, text
from sqlmodel import Field, SQLModel


class FileInformationOut(SQLModel):
    id: UUID
    filename: str
    size: int

    download_count: int
    created_at: int

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
    expires_at: datetime = Field()
    expire_after_n_download: int = Field()

    # Tracking downloads
    download_count: int = Field(default=0)
    created_at: datetime = Field()

    __table_args__ = (UniqueConstraint("id", "key"),)

    @property
    def is_expired(self) -> bool:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        return (
            now > self.expires_at or self.download_count >= self.expire_after_n_download
        )

    @model_validator(mode="after")
    def validate_expire(self) -> Self:
        if self.expires_at < self.created_at:
            raise ValueError("Expiration time cannot be earlier than creation time")
        return self
