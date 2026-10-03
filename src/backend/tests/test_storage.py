"""Storage backend tests — local filesystem + abstract contract + singleton.

The S3 backend is exercised against a fake in-memory aioboto3-style resource
so the full code path (including streaming) runs without network or moto.
"""

import asyncio
import io
from unittest.mock import patch

from asgiref.sync import async_to_sync
from django.conf import settings
from django.test import TransactionTestCase

from apps.files.services import (
    LocalStorageBackend,
    StorageBackend,
    delete_file_from_storage,
    download_file_data,
    download_file_path,
    download_file_stream,
    file_exists_in_storage,
    get_presigned_download_url,
    get_presigned_upload_url,
    get_storage,
    is_s3_backend,
    upload_file_data,
    upload_file_stream,
)

DATA = b"chithi-storage-payload-\x00\x01\x02"


class LocalStorageBackendTests(TransactionTestCase):
    def setUp(self):
        self.backend = LocalStorageBackend()

    def test_upload_and_download_roundtrip(self):
        async_to_sync(self.backend.upload)("a/b/key1", DATA)
        out = async_to_sync(self.backend.download)("a/b/key1")
        self.assertEqual(out, DATA)
        self.assertTrue((self.backend.root / "a" / "b" / "key1").exists())

    def test_stream_roundtrip(self):
        stream = io.BytesIO(DATA)
        async_to_sync(self.backend.upload_stream)("k2", stream, len(DATA))
        self.assertEqual(async_to_sync(self.backend.download)("k2"), DATA)

    def test_upload_stream_reads_from_position_zero(self):
        stream = io.BytesIO(DATA)
        stream.read(5)  # advance position on purpose
        async_to_sync(self.backend.upload_stream)("k3", stream, len(DATA))
        self.assertEqual(async_to_sync(self.backend.download)("k3"), DATA)

    def test_download_stream_chunking_and_close(self):
        async_to_sync(self.backend.upload)("k4", DATA)
        body = async_to_sync(self.backend.download_stream)("k4")

        async def _collect():
            chunks = []
            while True:
                chunk = await body.read(4)
                if not chunk:
                    break
                chunks.append(chunk)
            await body.close()
            return b"".join(chunks)

        self.assertEqual(async_to_sync(_collect)(), DATA)

    def test_download_missing_file_raises(self):
        with self.assertRaises(FileNotFoundError):
            async_to_sync(self.backend.download)("missing-key")

    def test_download_stream_missing_file_raises(self):
        async def _go():
            await self.backend.download_stream("missing-key")

        with self.assertRaises(FileNotFoundError):
            async_to_sync(_go)()

    def test_delete_existing_and_missing(self):
        async_to_sync(self.backend.upload)("k5", DATA)
        self.assertTrue(async_to_sync(self.backend.delete)("k5"))
        self.assertFalse(async_to_sync(delete_file_from_storage)("k5"))
        self.assertFalse(async_to_sync(self.backend.delete)("k5"))

    def test_exists(self):
        async_to_sync(self.backend.upload)("k6", DATA)
        self.assertTrue(async_to_sync(file_exists_in_storage)("k6"))
        self.assertFalse(async_to_sync(file_exists_in_storage)("nope"))

    def test_presigned_urls_unsupported_locally(self):
        self.assertIsNone(async_to_sync(get_presigned_upload_url)("x"))
        self.assertIsNone(async_to_sync(get_presigned_download_url)("x"))


class FakeS3Body:
    """Mimics aioboto3's StreamingBody read/close contract."""

    def __init__(self, data):
        self._data = data
        self._pos = 0
        self.closed = False

    async def read(self, size=-1):
        if self.closed or self._pos >= len(self._data):
            return b""
        if size < 0:
            chunk = self._data[self._pos:]
            self._pos = len(self._data)
            return chunk
        chunk = self._data[self._pos : self._pos + size]
        self._pos += len(chunk)
        return chunk

    async def close(self):
        self.closed = True


class FakeS3Object:
    store = {}

    def __init__(self, bucket, key):
        self.bucket = bucket
        self.key = key

    async def put(self, Body=None, ContentLength=None):
        data = Body.read() if hasattr(Body, "read") else bytes(Body)
        FakeS3Object.store[(self.bucket, self.key)] = data

    async def get(self):
        data = FakeS3Object.store.get((self.bucket, self.key))
        if data is None:
            raise KeyError(f"No object {self.key}")
        return {"Body": FakeS3Body(data)}

    async def load(self):
        if (self.bucket, self.key) not in FakeS3Object.store:
            raise KeyError("404")

    async def delete(self):
        FakeS3Object.store.pop((self.bucket, self.key), None)


class FakeS3Resource:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        class _Meta:
            class client:
                @staticmethod
                async def generate_presigned_url(method, Params, ExpiresIn):
                    return f"https://fake-s3/{Params['Key']}?method={method}&expires={ExpiresIn}"

        class _S3:
            meta = _Meta()

            def Object(inner, bucket, key):
                return FakeS3Object(bucket, key)

        return _S3()

    async def __aexit__(self, *exc):
        return False


class S3BackendTests(TransactionTestCase):
    """Run the real S3StorageBackend code against a fake aioboto3 resource."""

    def setUp(self):
        FakeS3Object.store.clear()
        self._patches = [
            patch(
                "apps.files.services._has_s3_settings",
                return_value=True,
            ),
            patch.dict(
                "django.conf.settings.__dict__",
                {
                    "AWS_ACCESS_KEY_ID": "test-key",
                    "AWS_SECRET_ACCESS_KEY": "test-secret",
                    "AWS_STORAGE_BUCKET_NAME": "test-bucket",
                    "AWS_S3_ENDPOINT_URL": "http://localhost:9000",
                },
            ),
        ]
        for p in self._patches:
            p.start()

        import apps.files.services as services

        self.services = services
        services._storage = None

        import types as _types

        self._fake_aioboto3 = _types.SimpleNamespace(
            resource=lambda *a, **kw: FakeS3Resource()
        )
        self._p_aioboto3 = patch.dict(
            "sys.modules", {"aioboto3": self._fake_aioboto3}
        )
        self._p_aioboto3.start()

    def tearDown(self):
        # Stop the in-memory channel layer / patches BEFORE the next test
        # setUp runs, so the cached storage doesn't leak.
        for p in reversed(self._patches):
            p.stop()
        self._p_aioboto3.stop()
        self.services._storage = None

    def test_is_s3_backend_true_when_configured(self):
        self.assertTrue(is_s3_backend())

    def test_get_storage_picks_s3(self):
        backend = get_storage()
        self.assertNotIsInstance(backend, LocalStorageBackend)
        self.assertEqual(backend._bucket, "test-bucket")

    def test_full_lifecycle_via_wrappers(self):
        s = self.services
        async_to_sync(s.upload_file_data)("s3key1", DATA)
        self.assertTrue(async_to_sync(s.file_exists_in_storage)("s3key1"))
        self.assertEqual(async_to_sync(s.download_file_data)("s3key1"), DATA)
        self.assertTrue(async_to_sync(s.delete_file_from_storage)("s3key1"))
        self.assertFalse(async_to_sync(s.file_exists_in_storage)("s3key1"))

    def test_stream_roundtrip_through_view_contract(self):
        s = self.services
        async_to_sync(upload_file_stream)("s3key2", io.BytesIO(DATA), len(DATA))

        body = async_to_sync(download_file_stream)("s3key2")

        async def _drain():
            chunks = []
            try:
                while True:
                    chunk = await body.read(256 * 1024)
                    if not chunk:
                        break
                    chunks.append(chunk)
            finally:
                await body.close()
            return b"".join(chunks)

        self.assertEqual(async_to_sync(_drain)(), DATA)

    @staticmethod
    def _run_presigned():
        """Exercise both presigned-URL paths under a fresh asyncio loop."""
        import asyncio

        async def _go():
            return await get_presigned_upload_url("k", 60), await get_presigned_download_url("k", 60)

        return asyncio.run(_go())

    def test_presigned_urls_generated(self):
        up, down = self._run_presigned()
        self.assertIn("https://fake-s3/k", up)
        self.assertIn("https://fake-s3/k", down)
        self.assertIn("method=put_object", up)
        self.assertIn("method=get_object", down)

    def test_download_file_path_rejected_on_s3(self):
        with self.assertRaises(NotImplementedError):
            download_file_path("whatever")


class SingletonTests(TransactionTestCase):
    def setUp(self):
        import apps.files.services as services

        services._storage = None

    def tearDown(self):
        import apps.files.services as services

        services._storage = None

    def test_singleton_cached(self):
        first = get_storage()
        second = get_storage()
        self.assertIs(first, second)

    def test_local_selected_without_s3_settings(self):
        backend = get_storage()
        self.assertIsInstance(backend, LocalStorageBackend)
