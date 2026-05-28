"""Tests for config domain service layer."""

import pytest


@pytest.mark.asyncio
async def test_get_config_creates_default():
    """get_config creates default config if none exists."""
    from apps.config.services.config_service import ConfigService

    svc = ConfigService()
    cfg = await svc.get_config()  # type: ignore[union-attr]
    assert cfg is not None  # type: ignore[truthy-assert]


@pytest.mark.asyncio
async def test_update_config():
    """Config fields can be partially updated."""
    from apps.config.services.config_service import ConfigService

    svc = ConfigService()
    await svc.update_config(default_expiry=3600)  # type: ignore[union-attr]
    cfg = await svc.get_config()  # type: ignore[union-attr]
    assert int(cfg.default_expiry) == 3600  # type: ignore[union-attr]
