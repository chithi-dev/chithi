from __future__ import annotations

import strawberry


@strawberry.type
class ConfigOut:
    id: strawberry.ID
    total_storage_limit: int
    max_file_size_limit: int
    default_expiry: int
    default_number_of_downloads: int
    site_description: str
    download_configs: list[int]
    time_configs: list[int]
    allowed_file_types: list[str]
    banned_file_types: list[str]
    allow_uploads: bool


@strawberry.input
class ConfigUpdateInput:
    total_storage_limit: int | None = None
    max_file_size_limit: int | None = None
    default_expiry: int | None = None
    default_number_of_downloads: int | None = None
    site_description: str | None = None
    download_configs: list[int] | None = None
    time_configs: list[int] | None = None
    allowed_file_types: list[str] | None = None
    banned_file_types: list[str] | None = None
    allow_uploads: bool | None = None
