from __future__ import annotations

import datetime
import strawberry
from typing import List, Optional


@strawberry.type
class RoomOut:
    """Room output with embedded files."""
    id: strawberry.ID
    name: str
    created_at: datetime.datetime
    expires_at: datetime.datetime
    expire_after: int
    number_of_downloads: Optional[int] = None
    files: List[RoomFileEntry] = strawberry.field(default_factory=list)


@strawberry.type
class RoomCreateResult:
    """Room creation result with host_token."""
    id: strawberry.ID
    name: str
    created_at: datetime.datetime
    expires_at: datetime.datetime
    expire_after: int
    number_of_downloads: Optional[int] = None
    files: List[RoomFileEntry] = strawberry.field(default_factory=list)
    active_uploads_count: int
    host_token: str


@strawberry.type
class RoomFileEntry:
    """A file entry inside a room."""
    key: str
    filename: str
    size: int
    uploaded_at: datetime.datetime


@strawberry.input
class RoomCreateInput:
    """Input for creating a new room."""
    name: str
    expire_after: int
    number_of_downloads: Optional[int] = None


@strawberry.type
class HostTokenResult:
    """Result of adding a host token to a room."""
    host_token: str
