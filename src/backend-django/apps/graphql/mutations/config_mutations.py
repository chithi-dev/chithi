import strawberry
import strawberry_django
from strawberry.types import Info

from apps.config.models import Config
from apps.graphql.types import ConfigType


@strawberry.type
class ConfigMutations:
    @strawberry_django.mutation
    def update_config(
        self,
        info: Info,
        total_storage_limit: int | None = None,
        max_file_size_limit: int | None = None,
        default_expiry: int | None = None,
        default_number_of_downloads: int | None = None,
        site_description: str | None = None,
        download_configs: list[int] | None = None,
        time_configs: list[int] | None = None,
        allowed_file_types: list[str] | None = None,
        banned_file_types: list[str] | None = None,
        allow_uploads: bool | None = None,
    ) -> ConfigType:
        config = Config.load()
        if total_storage_limit is not None:
            config.total_storage_limit = total_storage_limit
        if max_file_size_limit is not None:
            config.max_file_size_limit = max_file_size_limit
        if default_expiry is not None:
            config.default_expiry = default_expiry
        if default_number_of_downloads is not None:
            config.default_number_of_downloads = default_number_of_downloads
        if site_description is not None:
            config.site_description = site_description
        if download_configs is not None:
            config.download_configs = download_configs
        if time_configs is not None:
            config.time_configs = time_configs
        if allowed_file_types is not None:
            config.allowed_file_types = allowed_file_types
        if banned_file_types is not None:
            config.banned_file_types = banned_file_types
        if allow_uploads is not None:
            config.allow_uploads = allow_uploads
        config.save()
        return config
