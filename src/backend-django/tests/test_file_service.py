"""Tests for file service."""

from __future__ import annotations

import datetime

import pytest


class TestFileService:
    """Test file service operations."""

    async def test_validate_upload_limits(self) -> None:
        from apps.files.services.file_service import FileService
        limits = await FileService.validate_upload_limits(1024 * 1024)
        assert 'expires_at' in limits
        assert isinstance(limits['expires_at'], datetime.datetime)

    async def test_validate_exceeds_limit(self) -> None:
        from apps.files.services.file_service import FileService
        with pytest.raises(ValueError, match='exceeds limit'):
            await FileService.validate_upload_limits(999 * 1024**3)

    async def test_stream_file_iterator_exists(self) -> None:
        from apps.files.services.file_service import FileService
        # Verify the static method exists and returns an iterator
        result = list(FileService.stream_file_iterator('nonexistent-key.bin'))
        assert result == []  # No file, no data

    async def test_check_expiration_not_expired(self) -> None:
        from apps.files.services.file_service import FileService
        from apps.files.models import FileRecord
        
        future = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
        record = type('MockRecord', (), {
            'expires_at': future,
            'download_count': 0,
            'expire_after_n_download': 10,
            'is_expired': False,
        })()
        
        assert FileService.check_expiration(record) is False

    async def test_check_expiration_over_limit(self) -> None:
        from apps.files.services.file_service import FileService
        
        future = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
        record = type('MockRecord', (), {
            'expires_at': future,
            'download_count': 15,
            'expire_after_n_download': 10,
            'is_expired': True,
        })()
        
        assert FileService.check_expiration(record) is True
