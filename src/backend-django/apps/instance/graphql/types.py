from __future__ import annotations

import strawberry


@strawberry.type
class InstanceInfoOut:
    python_version: str
    django_version: str
    redis_version: str | None
    postgres_version: str | None
    version: str
    commit: str
    is_release: bool


@strawberry.type
class InstanceStatisticsOut:
    total_bytes: int
    total_files: int
    total_downloads: int
    active_urls: int
    active_rooms: int
    links_with_download_caps: int
    expiring_soon: int
    latest_expiry: int | None = strawberry.field(default=None)


@strawberry.type
class AdminStatsOut:
    users: int
    files: int
    rooms: int
    config_exists: bool
