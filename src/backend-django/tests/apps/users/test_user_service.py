"""Tests for users domain service layer."""


import pytest


@pytest.mark.asyncio
async def test_authenticate_by_username():
    """Users can authenticate via username."""
    from apps.users.models import User
    from apps.users.services.user_service import UserInfoService

    user = await User.objects.acreate_user(
        username="testuser",
        email="test@example.com",
        password=UserInfoService.hash_password("secret123"),
    )
    result = await UserInfoService().authenticate("testuser", "secret123")
    assert result is not None
    assert result.id == user.id  # type: ignore[union-attr]


@pytest.mark.asyncio
async def test_authenticate_by_email():
    """Users can authenticate via email address."""
    from apps.users.models import User
    from apps.users.services.user_service import UserInfoService

    await User.objects.acreate_user(
        username="emailuser",
        email="email@example.com",
        password=UserInfoService.hash_password("secret123"),
    )
    result = await UserInfoService().authenticate("email@example.com", "secret123")  # type: ignore[arg-type]
    assert result is not None


@pytest.mark.asyncio
async def test_authenticate_wrong_password():
    """Wrong password returns None."""
    from apps.users.models import User
    from apps.users.services.user_service import UserInfoService

    await User.objects.acreate_user(
        username="nouser",
        email="no@example.com",
        password=UserInfoService.hash_password("secret123"),
    )
    result = await UserInfoService().authenticate("nouser", "wrongpassword")  # type: ignore[arg-type]
    assert result is None


@pytest.mark.asyncio
async def test_create_user():
    """Users can be created."""
    from apps.users.services.user_service import UserInfoService

    user = await UserInfoService().create_user("newuser", "new@example.com", "pass123")  # type: ignore[arg-type]
    assert user.username == "newuser"  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_delete_user():
    """Users can be deleted."""
    from apps.users.models import User
    from apps.users.services.user_service import UserInfoService

    user = await User.objects.acreate_user(
        username="deleteme",
        email="del@example.com",
        password=UserInfoService.hash_password("pass123"),
    )
    deleted = await UserInfoService().delete_user(user.id)  # type: ignore[arg-type]
    assert deleted.username == "deleteme"  # type: ignore[attr-defined]
