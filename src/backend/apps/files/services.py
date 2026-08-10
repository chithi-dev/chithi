"""Storage service — supports both local filesystem and S3-compatible backends.

All backends implement the same async streaming interface so the download view
streams data regardless of where the file lives.

If S3 settings are configured in Django settings, files are stored on S3.
Otherwise files are stored on the local filesystem under MEDIA_ROOT.
"""

import abc
import asyncio
import io
import logging
import os
from pathlib import Path

from django.conf import settings
from django.utils.deconstruct import deconstructible

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# S3 detection
# ---------------------------------------------------------------------------


def _has_s3_settings() -> bool:
    """Return True if S3 settings are explicitly configured."""
    access_key = getattr(settings, "AWS_ACCESS_KEY_ID", None)
    secret_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", None)
    bucket = getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)
    return bool(access_key and secret_key and bucket)


def is_s3_backend() -> bool:
    """Return True if the active storage backend is S3."""
    return _has_s3_settings()


# ---------------------------------------------------------------------------
# Abstract storage backend
# ---------------------------------------------------------------------------


class StorageBackend(abc.ABC):
    """Abstract base class for storage backends.

    Every backend must implement ``download_stream`` so the download view can
    stream file data without knowing where the file lives.
    """

    @abc.abstractmethod
    async def upload(self, key: str, data: bytes) -> None:
        """Upload bytes to storage."""

    @abc.abstractmethod
    async def upload_stream(self, key: str, stream: io.BytesIO, size: int) -> None:
        """Upload a stream to storage."""

    @abc.abstractmethod
    async def download(self, key: str) -> bytes:
        """Download file from storage and return bytes."""

    @abc.abstractmethod
    async def download_stream(self, key: str) -> "asyncio.StreamReader | AsyncBodyStream":
        """Return an async-readable stream for chunked download.

        The returned object must support ``await obj.read(chunk_size)`` yielding
        ``bytes`` and returning empty bytes on EOF, plus ``await obj.close()``.
        """

    @abc.abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete a file from storage."""

    @abc.abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if a file exists in storage."""

    # Presigned URLs default to None (not supported by all backends).
    async def presigned_upload_url(self, key: str, expires_in: int = 3600) -> str | None:
        return None

    async def presigned_download_url(self, key: str, expires_in: int = 3600) -> str | None:
        return None


# ---------------------------------------------------------------------------
# Local storage backend
# ---------------------------------------------------------------------------

_LOCAL_CHUNK_SIZE = 256 * 1024  # 256 KB


class LocalStorageBackend(StorageBackend):
    """Store files on the local filesystem under MEDIA_ROOT."""

    def __init__(self) -> None:
        self.root = Path(settings.MEDIA_ROOT)
        self.root.mkdir(parents=True, exist_ok=True)

    async def upload(self, key: str, data: bytes) -> None:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    async def upload_stream(self, key: str, stream: io.BytesIO, size: int) -> None:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        stream.seek(0)
        path.write_bytes(stream.read(size))

    async def download(self, key: str) -> bytes:
        path = self.root / key
        return path.read_bytes()

    async def download_stream(self, key: str) -> _LocalAsyncFile:
        """Open the local file for async chunked reading."""
        path = self.root / key
        if not path.exists():
            raise FileNotFoundError(f"File not found: {key}")
        return _LocalAsyncFile(path)

    async def delete(self, key: str) -> bool:
        path = self.root / key
        if path.exists():
            path.unlink()
            return True
        return False

    async def exists(self, key: str) -> bool:
        return (self.root / key).exists()


class _LocalAsyncFile:
    """Thin wrapper around a local file to provide an async ``read``/``close`` interface
    matching the S3 body-stream contract used by the download view."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._fh: object = None  # opened file handle

    async def read(self, size: int = -1) -> bytes:
        if self._fh is None:
            self._fh = open(self._path, "rb")
        return self._fh.read(size) if size > 0 else self._fh.read()

    async def close(self) -> None:
        if self._fh:
            self._fh.close()
            self._fh = None


# ---------------------------------------------------------------------------
# S3 storage backend (lazy import — aioboto3 only needed if S3 is configured)
# ---------------------------------------------------------------------------


class S3StorageBackend(StorageBackend):
    """Store files on an S3-compatible backend."""

    def __init__(self) -> None:
        import aioboto3  # noqa: F811 — lazy import

        self._aioboto3 = aioboto3
        self._bucket = settings.AWS_STORAGE_BUCKET_NAME  # type: ignore[attr-defined]

    def _resource(self):
        return self._aioboto3.resource(
            "s3",
            endpoint_url=getattr(settings, "AWS_S3_ENDPOINT_URL", None),
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,  # type: ignore[attr-defined]
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,  # type: ignore[attr-defined]
        )

    def _client(self):
        return self._aioboto3.client(
            "s3",
            endpoint_url=getattr(settings, "AWS_S3_ENDPOINT_URL", None),
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,  # type: ignore[attr-defined]
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,  # type: ignore[attr-defined]
        )

    async def upload(self, key: str, data: bytes) -> None:
        res = self._resource()
        async with res as s3:
            await s3.Object(self._bucket, key).put(Body=data)

    async def upload_stream(self, key: str, stream: io.BytesIO, size: int) -> None:
        res = self._resource()
        async with res as s3:
            await s3.Object(self._bucket, key).put(Body=stream, ContentLength=size)

    async def download(self, key: str) -> bytes:
        res = self._resource()
        async with res as s3:
            obj = await s3.Object(self._bucket, key).get()
            body = obj["Body"]
            data = await body.read()
            await body.close()
            return data

    async def download_stream(self, key: str):
        """Return an async body stream for streaming responses."""
        res = self._resource()
        async with res as s3:
            obj = await s3.Object(self._bucket, key).get()
            return obj["Body"]

    async def delete(self, key: str) -> bool:
        res = self._resource()
        async with res as s3:
            await s3.Object(self._bucket, key).delete()
            return True

    async def exists(self, key: str) -> bool:
        res = self._resource()
        async with res as s3:
            try:
                await s3.Object(self._bucket, key).load()
                return True
            except Exception:
                return False

    async def presigned_upload_url(self, key: str, expires_in: int = 3600) -> str:
        res = self._resource()
        async with res as s3:
            return await s3.meta.client.generate_presigned_url(
                "put_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires_in,
            )

    async def presigned_download_url(self, key: str, expires_in: int = 3600) -> str:
        res = self._resource()
        async with res as s3:
            return await s3.meta.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires_in,
            )


# ---------------------------------------------------------------------------
# Singleton — pick the right backend at import time
# ---------------------------------------------------------------------------

_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    """Return the configured storage backend singleton."""
    global _storage
    if _storage is None:
        if _has_s3_settings():
            _storage = S3StorageBackend()
            logger.info("Storage backend: S3 (bucket=%s)", settings.AWS_STORAGE_BUCKET_NAME)  # type: ignore[attr-defined]
        else:
            _storage = LocalStorageBackend()
            logger.info("Storage backend: local (root=%s)", settings.MEDIA_ROOT)
    return _storage


# ---------------------------------------------------------------------------
# Convenience wrappers — forward to the active backend
# ---------------------------------------------------------------------------


async def upload_file_data(key: str, data: bytes) -> None:
    """Upload bytes to the configured storage backend."""
    await get_storage().upload(key, data)


async def upload_file_stream(key: str, stream: io.BytesIO, size: int) -> None:
    """Upload a stream to the configured storage backend."""
    await get_storage().upload_stream(key, stream, size)


async def download_file_data(key: str) -> bytes:
    """Download file from storage and return bytes."""
    return await get_storage().download(key)


async def download_file_stream(key: str):
    """Download file from storage and return the response stream.

    Works for both local and S3 backends.
    """
    return await get_storage().download_stream(key)


def download_file_path(key: str) -> Path:
    """Get the local file path (local backend only).

    Raises ``NotImplementedError`` when the active backend is S3.
    """
    storage = get_storage()
    if not isinstance(storage, LocalStorageBackend):
        raise NotImplementedError("S3 backend does not support direct file paths.")
    path = storage.root / key
    if not path.exists():
        raise FileNotFoundError(f"File not found: {key}")
    return path


async def delete_file_from_storage(key: str) -> bool:
    """Delete a file from storage."""
    return await get_storage().delete(key)


async def file_exists_in_storage(key: str) -> bool:
    """Check if a file exists in storage."""
    return await get_storage().exists(key)


async def get_presigned_upload_url(key: str, expires_in: int = 3600) -> str | None:
    """Generate a presigned URL for uploading (S3 only)."""
    return await get_storage().presigned_upload_url(key, expires_in)


async def get_presigned_download_url(key: str, expires_in: int = 3600) -> str | None:
    """Generate a presigned URL for downloading (S3 only)."""
    return await get_storage().presigned_download_url(key, expires_in)
