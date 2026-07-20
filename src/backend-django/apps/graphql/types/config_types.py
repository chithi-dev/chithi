import strawberry
from strawberry_django import type

from apps.config.models import Config


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
