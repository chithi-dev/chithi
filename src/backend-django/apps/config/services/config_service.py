from __future__ import annotations


from typing import Any


class ConfigService:
    """All configuration business logic."""

    @classmethod
    async def get_config(cls):
        """Return the single Config instance."""
        from apps.config.models import Config as _ConfigModel  # noqa: F811
        return await _ConfigModel.get_config()

    @staticmethod
    async def update_config(**kwargs: Any) -> Any:
        """Partial update on singleton config with validation.

        Validated fields:
          - default_expiry must be in time_configs
          - default_number_of_downloads must be in download_configs
          - allowed_file_types and banned_file_types == empty set
        """
        from apps.config.models import Config as _ConfigModel  # noqa: F811

        cfg = await _ConfigModel.get_config()

        time_configs = list(getattr(cfg, "time_configs", [])) or [604800]
        download_configs = list(getattr(cfg, "download_configs", [])) or [10]
        allowed_file_types = list(getattr(cfg, "allowed_file_types", []))
        banned_file_types = list(getattr(cfg, "banned_file_types", []))

        # Validate single fields first
        if "default_expiry" in kwargs:
            val = kwargs["default_expiry"]
            if not isinstance(val, int) or val <= 0:
                raise ValueError("default_expiry must be a positive integer")
            if time_configs and val not in time_configs:
                raise ValueError(
                    f"default_expiry {val} not in allowed time_configs {time_configs}"
                )

        if "default_number_of_downloads" in kwargs:
            val = kwargs["default_number_of_downloads"]
            if not isinstance(val, int) or val < 0:
                raise ValueError("default_number_of_downloads must be a non-negative integer")
            if download_configs and val not in download_configs:
                raise ValueError(
                    f"default_number_of_downloads {val} not in allowed download_configs {download_configs}"
                )

        # Validate intersection of allowed/banned file types
        if "allowed_file_types" in kwargs or "banned_file_types" in kwargs:
            new_allowed = kwargs.get("allowed_file_types", allowed_file_types)
            new_banned = kwargs.get("banned_file_types", banned_file_types)

            # If updating both, check intersection of the *new* values
            if "allowed_file_types" in kwargs and "banned_file_types" in kwargs:
                overlap = set(new_allowed) & set(new_banned)
                if overlap:
                    raise ValueError(
                        f"allowed_file_types and banned_file_types must not intersect; duplicates: {overlap}"
                    )

            # If updating allowed, check against existing banned
            elif "allowed_file_types" in kwargs:
                overlap = set(new_allowed) & set(banned_file_types)
                if overlap:
                    raise ValueError(
                        f"New allowed types conflict with existing banned types: {overlap}"
                    )

            # If updating banned, check against existing allowed
            elif "banned_file_types" in kwargs:
                overlap = set(new_banned) & set(allowed_file_types)
                if overlap:
                    raise ValueError(
                        f"New banned types conflict with existing allowed types: {overlap}"
                    )

        # Apply updates
        update_fields: list[str] = []
        for key, val in kwargs.items():
            setattr(cfg, key, val)
            update_fields.append(key)

        if not update_fields:
            raise ValueError("No fields to update")

        await cfg.asave(update_fields=update_fields + ["updated_at"])
        return cfg
