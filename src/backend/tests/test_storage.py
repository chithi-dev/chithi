"""Storage service tests — chunked local-filesystem backend.

The storage layer is a thin async wrapper over either S3 (when configured)
or a local-filesystem fallback (used in tests). All public functions are
async; the tests drive them with ``async_to_sync``.
"""

from asgiref.sync import async_to_sync
from django.test import TransactionTestCase

from apps.files.services import (
    CHUNK_SIZE_BYTES,
    chunk_key,
    file_chunks_exist,
    presigned_chunk_url,
    delete_file_chunks,
    upload_chunk,
)

DATA = b"chithi-storage-payload-\x00\x01\x02"


class ChunkKeyTests(TransactionTestCase):
    def test_chunk_key_format(self):
        self.assertEqual(chunk_key("file-uuid", 0), "file-uuid/chunk-0")
        self.assertEqual(chunk_key("file-uuid", 5), "file-uuid/chunk-5")

    def test_chunk_size_is_50mb(self):
        self.assertEqual(CHUNK_SIZE_BYTES, 50 * 1024 * 1024)


class LocalBackendTests(TransactionTestCase):
    def test_upload_and_presigned_url(self):
        key = "test-file-1"
        async_to_sync(upload_chunk)(key, 0, DATA)
        url = async_to_sync(presigned_chunk_url)(key, 0)
        self.assertIn(key, url)

    def test_upload_multiple_chunks(self):
        key = "test-file-2"
        async_to_sync(upload_chunk)(key, 0, b"chunk-zero")
        async_to_sync(upload_chunk)(key, 1, b"chunk-one")
        async_to_sync(upload_chunk)(key, 2, b"chunk-two")
        self.assertTrue(async_to_sync(file_chunks_exist)(key, 3))

    def test_file_chunks_exist_detects_missing(self):
        key = "test-file-3"
        async_to_sync(upload_chunk)(key, 0, b"only-zero")
        self.assertTrue(async_to_sync(file_chunks_exist)(key, 1))
        self.assertFalse(async_to_sync(file_chunks_exist)(key, 2))

    def test_delete_file_chunks(self):
        key = "test-file-4"
        async_to_sync(upload_chunk)(key, 0, b"a")
        async_to_sync(upload_chunk)(key, 1, b"b")
        self.assertTrue(async_to_sync(file_chunks_exist)(key, 2))

        async_to_sync(delete_file_chunks)(key)
        self.assertFalse(async_to_sync(file_chunks_exist)(key, 1))
        self.assertFalse(async_to_sync(file_chunks_exist)(key, 2))

    def test_delete_nonexistent_is_safe(self):
        async_to_sync(delete_file_chunks)("never-existed")
