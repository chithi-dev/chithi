from __future__ import annotations

import strawberry

from apps.config.graphql.types import ConfigOut
from apps.config.services.config_service import ConfigService


@strawberry.type
class ConfigQueries:
    @strawberry.field
    async def config(self, info: strawberry.types.Info) -> ConfigOut:
        """Get the singleton server configuration (no auth required)."""
        service = ConfigService()
        cfg = await service.get_config()

        return ConfigOut(
            id=cfg.id,
            total_storage_limit=int(cfg.total_storage_limit),
            max_file_size_limit=int(cfg.max_file_size_limit),
            default_expiry=int(cfg.default_expiry),
            default_number_of_downloads=int(cfg.default_number_of_downloads),
            site_description=str(cfg.site_description),
            download_configs=list(getattr(cfg, "download_configs", []) or []),
            time_configs=list(getattr(cfg, "time_configs", []) or []),
            allowed_file_types=list(getattr(cfg, "allowed_file_types", []) or []),
            banned_file_types=list(getattr(cfg, "banned_file_types", []) or []),
            allow_uploads=bool(cfg.allow_uploads),
        )


@strawberry.type
class Query(ConfigQueries):
    pass
