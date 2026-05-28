"""Tests for user services."""

from __future__ import annotations

import pytest

from apps.users.services.user_service import UserInfoService


class TestUserInfoService:
    """Test user service operations."""

    async def test_hash_password(self) -> None:
        hashed = UserInfoService.hash_password('testpass123')
        assert hashed.startswith('$argon2')
        assert UserInfoService.verify_password('testpass123', hashed) is True
        assert UserInfoService.verify_password('wrongpass', hashed) is False

    async def test_verify_password_roundtrip(self) -> None:
        for pwd in ['simple', 'with spaces ', 'special!@#$%']:
            h = UserInfoService.hash_password(pwd)
            assert UserInfoService.verify_password(pwd, h)

    async def test_authenticate_not_exists(self) -> None:
        result = await UserInfoService.authenticate('nonexistent', 'password')
        assert result is None
