"""Tests for config service."""

from __future__ import annotations

import pytest

from apps.config.services.config_service import ConfigService


class TestConfigService:
    """Test config service operations."""

    async def test_get_config_creates_default(self) -> None:
        service = ConfigService()
        cfg = await service.get_config()
        assert cfg is not None
        assert int(cfg.default_number_of_downloads) == 10
        assert int(cfg.max_file_size_limit) > 0

    async def test_update_config_changes_expiry(self, sample_config_defaults: dict) -> None:
        service = ConfigService()
        cfg = await service.get_config()
        original_expiry = int(cfg.default_expiry)
        new_cfg = await service.update_config(default_expiry=3600)  # type: ignore[arg-type]
        assert int(new_cfg.default_expiry) == 3600

    async def test_update_config_invalid_expiry_not_in_configs(self) -> None:
        service = ConfigService()
        with pytest.raises(ValueError, match='not in allowed time_configs'):
            await service.update_config(default_expiry=99999)  # type: ignore[arg-type]

    async def test_update_config_file_types_no_overlap(self) -> None:
        service = ConfigService()
        new_cfg = await service.update_config(  # type: ignore[arg-type]
            allowed_file_types=['.txt', '.md'],
            banned_file_types=['.exe', '.bat']
        )
        assert set(new_cfg.allowed_file_types) & set(new_cfg.banned_file_types) == set()

    async def test_update_config_invalid_file_types_overlap(self) -> None:
        service = ConfigService()
        with pytest.raises(ValueError, match='must not intersect'):
            await service.update_config(  # type: ignore[arg-type]
                allowed_file_types=['.txt'],
                banned_file_types=['.txt']
            )

    async def test_update_requires_fields(self) -> None:
        service = ConfigService()
        with pytest.raises(ValueError, match='No fields to update'):
            await service.update_config()  # type: ignore[arg-type]
