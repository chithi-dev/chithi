import strawberry
from strawberry.types import Info

from apps.config.models import Config
from apps.graphql.types import ConfigType


@strawberry.type
class ConfigMutations:
    """Site configuration mutations."""

    @strawberry.mutation
    def update_config(
        self,
        info: Info,
        total_storage_limit: int | None = None,
        max_file_size_limit: int | None = None,
        default_expiry: int | None = None,
        default_number_of_downloads: int | None = None,
        site_description: str | None = None,
        allow_uploads: bool | None = None,
    ) -> ConfigType:
        config = Config.load()

        for field, value in {
            "total_storage_limit": total_storage_limit,
            "max_file_size_limit": max_file_size_limit,
            "default_expiry": default_expiry,
            "default_number_of_downloads": default_number_of_downloads,
            "site_description": site_description,
            "allow_uploads": allow_uploads,
        }.items():
            if value is not None:
                setattr(config, field, value)

        config.save()
        return config
