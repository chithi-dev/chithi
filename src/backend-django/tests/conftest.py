"""Shared test fixtures for Django backend tests."""

from __future__ import annotations

import os
from uuid import UUID, uuid4

import pytest


@pytest.fixture(autouse=True)
def _setup_django_env() -> None:
    """Ensure DJANGO_SETTINGS_MODULE is set before each test."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    if not os.environ.get("DJANGO_SECRET_KEY"):
        os.environ["DJANGO_SECRET_KEY"] = "test-secret-key-for-testing-1234567890"


@pytest.fixture
def sample_user_data() -> dict:
    return {
        "username": "testuser",
        "email": "test@example.com",
        "password": "securepass123",
    }


@pytest.fixture
def sample_config_defaults() -> dict:
    return {
        "total_storage_limit": 10 * 1024**3,
        "max_file_size_limit": 100 * 1024**2,
        "default_expiry": 604800,
        "default_number_of_downloads": 10,
        "site_description": "Test instance",
        "download_configs": [10],
        "time_configs": [604800],
        "allowed_file_types": [],
        "banned_file_types": [],
        "allow_uploads": True,
    }


@pytest.fixture
def sample_file_data() -> dict:
    return {
        "key": str(uuid4()),
        "filename": "test-file.bin",
        "size": 1024 * 1024,
        "number_of_files": 1,
    }


@pytest.fixture
def sample_room_data() -> dict:
    return {
        "name": "Test Room",
        "expire_after": 3600,
        "number_of_downloads": 5,
    }
