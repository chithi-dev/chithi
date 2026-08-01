import strawberry
from asgiref.sync import sync_to_async

from apps.config.models import Config
from apps.graphql.types import ConfigType


@strawberry.type
class ConfigMutation:
    @strawberry.mutation
    async def update_config(
        self,
        total_storage_limit: int | None = None,
        max_file_size_limit: int | None = None,
        default_expiry: int | None = None,
        default_number_of_downloads: int | None = None,
        site_description: str | None = None,
        allow_uploads: bool | None = None,
    ) -> ConfigType:
        config = await sync_to_async(Config.objects.get_or_create)(pk=1)[0]
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
        if allow_uploads is not None:
            config.allow_uploads = allow_uploads
        await sync_to_async(config.save)()
        return config
