from __future__ import annotations

from typing import Any


class ConfigService:
    @staticmethod
    async def update_config(**kwargs: Any) -> Any:  # type: ignore[return]
        from apps.config.models import Config as _ConfigModel

        cfg = await _ConfigModel.get_config()
        time_configs = list(getattr(cfg, "time_configs", []) or [604800])
        download_configs = list(getattr(cfg, "download_configs", []) or [10])

        if "default_expiry" in kwargs:
            val = kwargs["default_expiry"]
            if not isinstance(val, int) or val <= 0 or (time_configs and val not in time_configs):
                raise ValueError(f"default_expiry {val} must be a positive integer in {time_configs}")

        if "default_number_of_downloads" in kwargs:
            val = kwargs["default_number_of_downloads"]
            if not isinstance(val, int) or val < 0 or (download_configs and val not in download_configs):
                raise ValueError(f"default_number_of_downloads must be a non-negative integer in {download_configs}")

        allowed = list(getattr(cfg, "allowed_file_types", []) or [])
        banned = list(getattr(cfg, "banned_file_types", []) or [])

        if "allowed_file_types" in kwargs and "banned_file_types" in kwargs:
            overlap = set(kwargs["allowed_file_types"]) & set(kwargs["banned_file_types"])
            if overlap:
                raise ValueError(f"Types must not intersect; duplicates: {overlap}")
        elif "allowed_file_types" in kwargs:
            overlap = set(kwargs["allowed_file_types"]) & set(banned)
            if overlap:
                raise ValueError(f"New allowed types conflict with existing banned: {overlap}")
        elif "banned_file_types" in kwargs:
            overlap = set(kwargs["banned_file_types"]) & set(allowed)
            if overlap:
                raise ValueError(f"New banned types conflict with existing allowed: {overlap}")

        update_fields = []
        for key, val in kwargs.items():
            setattr(cfg, key, val)
            update_fields.append(key)

        if not update_fields:
            raise ValueError("No fields to update")

        await cfg.asave(update_fields=update_fields + ["updated_at"])
        return cfg
