"""Tests for the chunked storage service (local filesystem backend)."""

import pytest

from apps.files.services import (
    CHUNK_SIZE_BYTES,
    chunk_key,
    delete_file_chunks,
    file_chunks_exist,
    presigned_chunk_url,
    upload_chunk,
)


@pytest.mark.django_db
class TestUploadChunk:
    async def test_writes_chunk_to_storage(self, storage):
        await upload_chunk("file-a", 0, b"hello")
        assert storage.exists(chunk_key("file-a", 0))

    async def test_chunk_size_constant(self):
        assert CHUNK_SIZE_BYTES == 50 * 1024 * 1024


@pytest.mark.django_db
class TestFileChunksExist:
    async def test_true_when_all_present(self):
        await upload_chunk("file-b", 0, b"one")
        await upload_chunk("file-b", 1, b"two")
        assert await file_chunks_exist("file-b", 2)

    async def test_false_when_missing(self):
        await upload_chunk("file-c", 0, b"only")
        assert not await file_chunks_exist("file-c", 2)


@pytest.mark.django_db
class TestPresignedChunkUrl:
    async def test_returns_media_url(self):
        await upload_chunk("file-d", 0, b"data")
        url = await presigned_chunk_url("file-d", 0)
        assert "file-d/chunk-0" in url


@pytest.mark.django_db
class TestDeleteFileChunks:
    async def test_removes_all_chunks(self):
        await upload_chunk("file-e", 0, b"a")
        await upload_chunk("file-e", 1, b"b")
        await delete_file_chunks("file-e")
        assert not await file_chunks_exist("file-e", 1)
