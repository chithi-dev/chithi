from __future__ import annotations



import strawberry

from typing import Any



from core.auth.jwt_auth import get_current_user

from apps.config.graphql.types import ConfigOut, ConfigUpdateInput

from apps.config.services.config_service import ConfigService





@strawberry.type

class ConfigMutations:

    @strawberry.mutation

    async def update_config(

        self, info: strawberry.types.Info, input: ConfigUpdateInput  # noqa: A002 - intentional shadowing

    ) -> ConfigOut:

        """Partial config update (auth required)."""

        from core.auth.jwt_auth import get_current_user

        user = await get_current_user(info)

        if not user:

            raise PermissionError("Authentication required")



        service = ConfigService()



        kwargs: dict[str, Any] = {}

        for field in [

            "total_storage_limit", "max_file_size_limit", "default_expiry",

            "default_number_of_downloads", "site_description",

            "download_configs", "time_configs", "allowed_file_types",

            "banned_file_types", "allow_uploads",

        ]:

            val = getattr(input, field, None)

            if val is not None:

                kwargs[field] = val



        cfg = await service.update_config(**kwargs)



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

class Mutation(ConfigMutations):

    pass

