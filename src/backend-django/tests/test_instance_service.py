"""Tests for instance service."""

from __future__ import annotations


class TestInstanceService:
    """Test instance service operations."""

    async def test_get_instance_info(self) -> None:
        from apps.instance.services.instance_service import InstanceService
        
        service = InstanceService()
        info = await service.get_instance_info()
        
        assert 'python_version' in info
        assert 'django_version' in info
        assert isinstance(info['django_version'], tuple)

    async def test_get_instance_statistics(self) -> None:
        from apps.instance.services.instance_service import InstanceService
        
        service = InstanceService()
        stats = await service.get_instance_statistics()
        
        assert 'total_bytes' in stats
        assert 'total_files' in stats
        assert 'total_downloads' in stats
        assert isinstance(stats['total_bytes'], int)
        assert isinstance(stats['total_files'], int)


class TestGetRedisVersion:
    """Test Redis version detection."""

    async def test_get_redis_version_with_url(self) -> None:
        from apps.instance.services.instance_service import get_redis_version
        
        # Without Redis running, should return None gracefully
        result = await get_redis_version()
        if result is not None:
            assert isinstance(result, str)


class TestGetPostgresVersion:
    """Test PostgreSQL version detection."""

    async def test_get_postgres_version(self) -> None:
        from apps.instance.services.instance_service import get_postgres_version
        
        result = await get_postgres_version()
        if result is not None:
            assert isinstance(result, str)
