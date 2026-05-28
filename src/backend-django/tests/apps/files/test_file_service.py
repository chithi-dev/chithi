"""Tests for files domain service layer."""


import pytest


@pytest.mark.asyncio
async def test_create_file_record():
    """File records can be created with valid data."""
    from apps.files.services.file_service import FileService

    record = await FileService().create_file_record(  # type: ignore[arg-type]
        storage_key="test-key-001",
        filename="test.txt",
        size=1024,
        expires_at="2030-01-01T00:00:00+00:00",  # type: ignore[arg-type]
    )
    assert record is not None
    assert record.key == "test-key-001"  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_get_file_by_key():
    """Files can be retrieved by storage key."""
    from apps.files.services.file_service import FileService

    record = await FileService().create_file_record(  # type: ignore[arg-type]
        storage_key="lookup-key",
        filename="lookup.txt",
        size=512,
        expires_at="2030-01-01T00:00:00+00:00",  # type: ignore[arg-type]
    )
    found = await FileService().get_file_by_key("lookup-key")
    assert found is not None  # type: ignore[truthy-assert]


@pytest.mark.asyncio
async def test_get_nonexistent_file():
    """Non-existent files return None."""
    result = await FileService().get_file_by_key("no-such-key")
    assert result is None


@pytest.mark.asyncio
async def test_paginated_files():
    """Files can be retrieved with pagination metadata."""
    from apps.files.services.file_service import FileService

    for i in range(5):
        await FileService().create_file_record(  # type: ignore[arg-type]
            storage_key=f"pg-key-{i}",
            filename=f"file_{i}.txt",
            size=100 * (i + 1),
            expires_at="2030-01-01T00:00:00+00:00",  # type: ignore[arg-type]
        )

    items, meta = await FileService().get_paginated_files(page=1, page_size=5)  # type: ignore[arg-type]
    assert len(items) == 5  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_increment_download_count():
    """Download count increments correctly."""
    from apps.files.services.file_service import FileService

    record = await FileService().create_file_record(  # type: ignore[arg-type]
        storage_key="count-key",
        filename="count.txt",
        size=256,
        expires_at="2030-01-01T00:00:00+00:00",  # type: ignore[arg-type]
    )
    new_count = await FileService().increment_download_count(record)  # type: ignore[arg-type]
    assert int(new_count) == 1  # type: ignore[union-attr]
