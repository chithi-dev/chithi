from datetime import datetime

from sqlmodel import SQLModel


class RoomFileEntry(SQLModel):
    key: str
    filename: str
    size: int
    uploaded_at: datetime
    download_url: str


class RoomOut(SQLModel):
    id: str
    name: str
    created_at: datetime
    expires_at: datetime
    files: list[RoomFileEntry] = []
    host_count: int = 1
    number_of_downloads: int | None


class RoomCreateOut(RoomOut):
    """Returned only once at room creation - includes the host secret."""

    host_token: str


class RoomCreate(SQLModel):
    name: str
    expire_after: int  # seconds from now


class RoomIn(SQLModel):
    name: str
    expire_after: int  # seconds from now
    number_of_downloads: int | None = None


class AddHostOut(SQLModel):
    host_token: str


class RoomFileEvent(SQLModel):
    """Pushed to WebSocket subscribers on file activity."""

    event: str  # "file_added" | "file_removed"
    file: RoomFileEntry
