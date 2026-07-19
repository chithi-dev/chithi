from datetime import datetime

import strawberry
from strawberry_django import type

from apps.config.models import Config
from apps.files.models import File
from apps.users.models import User


@strawberry.type
class TokenResponse:
    access: str
    refresh: str


@strawberry.type
class OnboardingType:
    is_configured: bool
    has_users: bool


@type(model=User)
class UserType:
    id: strawberry.ID
    username: str
    email: str | None
    created_at: datetime


@type(model=File)
class FileType:
    id: strawberry.ID
    key: str
    filename: str
    size: int
    number_of_files: int | None
    download_count: int
    created_at: datetime
    expires_at: datetime
    expire_after_n_download: int
    is_expired: bool


@type(model=Config)
class ConfigType:
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
