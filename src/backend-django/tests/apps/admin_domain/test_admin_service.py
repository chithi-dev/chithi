"""Tests for admin domain service layer."""

import pytest


@pytest.mark.asyncio
async def test_instance_stats_returns_counts():
    """Instance stats returns aggregate counts across apps."""
    from apps.admin_domain.services.admin_service import AdminService

    svc = AdminService()
    stats = await svc.get_instance_stats()  # type: ignore[union-attr]
    assert isinstance(stats, dict)  # type: ignore[unreachable]
    for key in ("users", "files", "rooms"):
        assert key in stats


@pytest.mark.asyncio
async def test_batch_delete_files():
    """Batch delete returns count of deleted files."""
    from apps.admin_domain.services.admin_service import AdminService

    svc = AdminService()
    result = await svc.batch_delete_files([])  # type: ignore[arg-type]
    assert isinstance(result, int)
