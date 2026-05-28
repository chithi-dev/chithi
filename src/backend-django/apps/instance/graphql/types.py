"""Instance GraphQL types."""

from __future__ import annotations

import datetime

import strawberry


@strawberry.type
class InstanceInfoOut:
    """Server instance information."""

    python_version: str
    django_version: str
    redis_version: str | None
    postgres_version: str | None
    version: str
    commit: str
    is_release: bool


@strawberry.type
class InstanceStatisticsOut:
    """Aggregate instance statistics (no auth)."""

    total_bytes: int
    total_files: int
    total_downloads: int
    active_urls: int
    active_rooms: int
    links_with_download_caps: int
    expiring_soon: int
    latest_expiry: int | None = strawberry.field(default=None)


@strawberry.type
class RoomOut:
    """Room output for statistics."""

    id: strawberry.ID
    name: str
    active_urls: int
    expires_at: datetime.datetime


@strawberry.type
class AdminStatsOut:
    """Aggregate instance statistics (auth required)."""

    users: int
    files: int
    rooms: int
    config_exists: bool
