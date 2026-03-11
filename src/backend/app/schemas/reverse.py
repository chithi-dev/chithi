from datetime import datetime

from pydantic import BaseModel


class RoomFileEntry(BaseModel):
    key: str
    filename: str
    size: int
    uploaded_at: datetime
    download_url: str


class RoomOut(BaseModel):
    id: str
    name: str
    created_at: datetime
    expires_at: datetime
    files: list[RoomFileEntry] = []
    host_count: int = 1


class RoomCreateOut(RoomOut):
    """Returned only once at room creation — includes the host secret."""

    host_token: str


class RoomCreate(BaseModel):
    name: str
    expire_after: int  # seconds from now


class AddHostOut(BaseModel):
    host_token: str


class RoomFileEvent(BaseModel):
    """Pushed to WebSocket subscribers on file activity."""

    event: str  # "file_added" | "file_removed"
    file: RoomFileEntry
