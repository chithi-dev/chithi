from __future__ import annotations

import strawberry


@strawberry.type
class ConfigMutations:
    @strawberry.mutation
    async def update_config(
        self, info: strawberry.types.Info, input: "ConfigUpdateInput"  # type: ignore[name-defined]
    ) -> "ConfigOut":  # type: ignore[name-defined]
        from apps.config.models import Config as _ConfigModel

        cfg = await _ConfigModel.get_config()
        time_configs = list(getattr(cfg, "time_configs") or [604800])
        download_configs = list(getattr(cfg, "download_configs") or [10])

        if "default_expiry" in input.__dict__ and input.default_expiry is not None:
            val = input.default_expiry
            if not isinstance(val, int) or val <= 0 or (time_configs and val not in time_configs):
                raise ValueError(f"default_expiry {val} must be positive integer in {time_configs}")

        if "default_number_of_downloads" in input.__dict__ and input.default_number_of_downloads is not None:
            val = input.default_number_of_downloads
            if not isinstance(val, int) or val < 0 or (download_configs and val not in download_configs):
                raise ValueError(f"default_number_of_downloads must be non-negative integer in {download_configs}")

        allowed = list(getattr(cfg, "allowed_file_types") or [])
        banned = list(getattr(cfg, "banned_file_types") or [])

        new_allowed = getattr(input, "allowed_file_types", None)
        new_banned = getattr(input, "banned_file_types", None)
        if new_allowed and new_banned:
            overlap = set(new_allowed) & set(new_banned)
            if overlap:
                raise ValueError(f"Types must not intersect; duplicates: {overlap}")
        elif new_allowed:
            overlap = set(new_allowed) & set(banned)
            if overlap:
                raise ValueError(f"New allowed types conflict with existing banned: {overlap}")
        elif new_banned:
            overlap = set(new_banned) & set(allowed)
            if overlap:
                raise ValueError(f"New banned types conflict with existing allowed: {overlap}")

        update_fields = []
        for field in ["total_storage_limit", "max_file_size_limit", "default_expiry", "default_number_of_downloads",
                       "site_description", "download_configs", "time_configs", "allowed_file_types", "banned_file_types", "allow_uploads"]:
            val = getattr(input, field)  # type: ignore[arg-type]
            if val is not None:
                setattr(cfg, field, val)
                update_fields.append(field)

        if not update_fields:
            raise ValueError("No fields to update")

        await cfg.asave(update_fields=update_fields + ["updated_at"])

        return ConfigOut(  # type: ignore[call-arg]
            id=cfg.id,
            total_storage_limit=int(cfg.total_storage_limit),
            max_file_size_limit=int(cfg.max_file_size_limit),
            default_expiry=int(cfg.default_expiry),
            default_number_of_downloads=int(cfg.default_number_of_downloads),
            site_description=str(cfg.site_description),
            download_configs=list(getattr(cfg, "download_configs") or []),
            time_configs=list(getattr(cfg, "time_configs") or []),
            allowed_file_types=list(getattr(cfg, "allowed_file_types") or []),
            banned_file_types=list(getattr(cfg, "banned_file_types") or []),
            allow_uploads=bool(cfg.allow_uploads),
        )


@strawberry.type
class Mutation(ConfigMutations):
    pass
