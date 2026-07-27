from strawberry_django import type

from apps.config.models import Config
from apps.graphql.types.scalars import BigInt


@type(model=Config)
class ConfigType:
    total_storage_limit: BigInt
    max_file_size_limit: BigInt
    default_expiry: int
    default_number_of_downloads: int
    site_description: str
    download_configs: list[int]
    time_configs: list[int]
    allowed_file_types: list[str]
    banned_file_types: list[str]
    allow_uploads: bool
