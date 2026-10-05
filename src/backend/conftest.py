"""Shared pytest fixtures for the chithi backend test suite."""

import pytest


@pytest.fixture
def storage():
    """Return the configured default storage backend."""
    from django.core.files.storage import default_storage

    return default_storage
