from datetime import datetime
from uuid import UUID

from pydantic import model_validator
from sqlalchemy import text
from sqlmodel import Field, SQLModel


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
    created_at: datetime = Field()

    @model_validator(mode="after")
    def validate_expire(self) -> "File":
        if self.expires_at < self.created_at:
            raise ValueError("Expiration time cannot be earlier than creation time")
        return self
