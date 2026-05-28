from __future__ import annotations

import strawberry
from typing import List, Optional


@strawberry.type
class ConfigOut:
    """Full config output."""
    id: strawberry.ID
    total_storage_limit: int
    max_file_size_limit: int
    default_expiry: int
    default_number_of_downloads: int
    site_description: str
    download_configs: List[int]
    time_configs: List[int]
    allowed_file_types: List[str]
    banned_file_types: List[str]
    allow_uploads: bool


@strawberry.input
class ConfigUpdateInput:
    """Partial update input for config mutation."""
    total_storage_limit: Optional[int] = None
    max_file_size_limit: Optional[int] = None
    default_expiry: Optional[int] = None
    default_number_of_downloads: Optional[int] = None
    site_description: Optional[str] = None
    download_configs: Optional[List[int]] = None
    time_configs: Optional[List[int]] = None
    allowed_file_types: Optional[List[str]] = None
    banned_file_types: Optional[List[str]] = None
    allow_uploads: Optional[bool] = None
