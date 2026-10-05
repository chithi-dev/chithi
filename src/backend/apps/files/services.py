"""Storage service - chunked file upload/download via Django storage backends.

Architecture:
- **Upload**: the frontend splits the encrypted payload into 50 MB chunks and
  uploads each chunk through a GraphQL mutation or the ninja API. Django writes
  each chunk as a separate object under ``{file_key}/chunk-{index}``.
- **Download**: the frontend fetches each chunk **directly from the storage
  backend** using presigned URLs (S3) or a MEDIA_URL path (local), then
  reassembles and decrypts. Django is not in the download hot path.

The storage backend is selected at startup in ``settings.py`` via the
``STORAGES`` setting: ``S3Storage`` when credentials are present,
``FileSystemStorage`` otherwise. All access goes through
``django.core.files.storage.default_storage`` so the rest of the app is
backend-agnostic.
"""

import asyncio
import datetime
import logging
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING

from asgiref.sync import sync_to_async
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage, default_storage

if TYPE_CHECKING:
    from django.core.files.storage import Storage

logger = logging.getLogger(__name__)

# 50 MB chunk size - the unit of upload/download. Must match the frontend.
CHUNK_SIZE_BYTES = 50 * 1024 * 1024


def _storage() -> "Storage":
    """Return the configured default storage backend."""
    return default_storage


def chunk_key(file_key: str, index: int) -> str:
    """Object key for a single chunk of a file."""
    return f"{file_key}/chunk-{index}"


def _cdn_chunk_url(key: str) -> str:
    """Build a public CDN URL for a single chunk object key.

    Returns an empty string when S3_CDN_URL is not configured, so the
    caller can fall back to a presigned / relative URL.
    """
    cdn_base = getattr(settings, "S3_CDN_URL", "")
    if not cdn_base:
        return ""
    return f"{cdn_base}/{key}"


async def upload_chunk(file_key: str, index: int, data: bytes) -> None:
    """Upload a single chunk (<= 50 MB) to storage."""
    key = chunk_key(file_key, index)
    await sync_to_async(_storage().save)(key, ContentFile(data))
    logger.debug("Uploaded chunk %s/%d (%d bytes)", file_key, index, len(data))


async def presigned_chunk_url(
    file_key: str, index: int, expires_in: int = 3600
) -> str:
    """Return a URL the frontend can use to fetch one chunk directly.

    Priority:
      1. S3_CDN_URL -- static CDN URL (Cloudflare, B2 CDN). No signing needed.
      2. Presigned S3 URL -- signed by the S3 endpoint (B2, R2, etc.).
      3. Local MEDIA_URL -- Django serves the file from the filesystem.
    """
    key = chunk_key(file_key, index)

    cdn_url = _cdn_chunk_url(key)
    if cdn_url:
        return cdn_url

    return await sync_to_async(_storage().url)(key)


def _cdn_base() -> str:
    """The configured CDN base URL, or ``""`` when none is set."""
    return getattr(settings, "S3_CDN_URL", "") or ""


async def _stream_from_cdn(
    file_key: str, index: int, read_size: int
) -> AsyncIterator[bytes]:
    """Stream chunk bytes from the CDN via httpx (async, non-blocking)."""
    import httpx

    url = f"{_cdn_base()}/{chunk_key(file_key, index)}"

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            async for block in response.aiter_bytes(read_size):
                if block:
                    yield block


def _is_local_storage() -> bool:
    """True when the active storage backend is a local filesystem."""
    return isinstance(_storage(), FileSystemStorage)


async def _stream_from_local(
    file_key: str, index: int, read_size: int
) -> AsyncIterator[bytes]:
    """Stream chunk bytes from a local filesystem using aiofiles (true async)."""
    import aiofiles

    key = chunk_key(file_key, index)
    path = _storage().path(key)

    async with aiofiles.open(path, "rb") as fh:
        while True:
            block = await fh.read(read_size)
            if not block:
                break
            yield block


async def _stream_from_s3(
    file_key: str, index: int, read_size: int
) -> AsyncIterator[bytes]:
    """Stream chunk bytes from an S3-backed storage backend via the thread pool."""
    key = chunk_key(file_key, index)

    def _open() -> object:
        return _storage().open(key, "rb")

    fh = await sync_to_async(_open)()
    try:
        while True:
            block = await sync_to_async(fh.read, thread_sensitive=False)(read_size)
            if not block:
                break
            yield block
            await asyncio.sleep(0)
    finally:
        await sync_to_async(fh.close, thread_sensitive=False)()


async def _stream_from_storage(
    file_key: str, index: int, read_size: int
) -> AsyncIterator[bytes]:
    """Stream chunk bytes from the storage backend (local or S3)."""
    if _is_local_storage():
        async for block in _stream_from_local(file_key, index, read_size):
            yield block
    else:
        async for block in _stream_from_s3(file_key, index, read_size):
            yield block


async def open_chunk_stream(
    file_key: str, index: int, read_size: int = 1024 * 1024
) -> AsyncIterator[bytes]:
    """Stream one chunk's bytes, transparently from CDN or storage backend.

    This is the single public interface the view layer calls to proxy a
    chunk. It picks the CDN path (httpx, fully async) when ``S3_CDN_URL``
    is set, otherwise reads from the storage backend (S3 object or local
    filesystem) in a thread pool. The caller simply wraps the returned
    async iterator in a ``StreamingHttpResponse``.
    """
    if _cdn_base():
        async for block in _stream_from_cdn(file_key, index, read_size):
            yield block
    else:
        async for block in _stream_from_storage(file_key, index, read_size):
            yield block


async def delete_file_chunks(file_key: str) -> None:
    """Delete every chunk of a file from storage."""
    await sync_to_async(_delete_by_prefix)(f"{file_key}/")


def schedule_expiry(file_key: str, expires_at: datetime.datetime) -> None:
    """Enqueue a one-shot deletion of *file_key* at its expiry instant.

    Shared by both transports (GraphQL ``register_file`` and the ninja
    ``/upload/register/``) so they schedule identically. The countdown is
    derived from the same Django-timezone-aware ``expires_at`` that is
    persisted, so the schedule and the stored value can never drift. A
    non-positive countdown (already expired) is skipped -- the file will be
    refused at first access instead.
    """
    from django.utils import timezone

    from apps.files.tasks import delete_file_after_expiry

    # Both endpoints are timezone-aware, so the difference is a plain
    # timedelta; total_seconds() is the stdlib way to get a numeric countdown.
    countdown = (expires_at - timezone.now()).total_seconds()
    if countdown > 0:
        delete_file_after_expiry.apply_async(args=[file_key], countdown=countdown)


def _increment_download_count(file_key: str) -> tuple[int, int]:
    """Atomically bump a file's download count and return (new count, limit).

    Uses ``F()`` so concurrent chunk fetches don't lose updates (no read-modify
    write race). Returns the post-increment count and the file's
    ``expire_after_n_download`` limit so the caller can decide whether the file
    has just hit its download-count expiry.
    """
    from django.db.models import F

    from apps.files.models import File

    File.objects.filter(key=file_key).update(download_count=F("download_count") + 1)
    fresh = File.objects.get(key=file_key)
    return fresh.download_count, fresh.expire_after_n_download


async def record_download(file_key: str) -> None:
    """Count a chunk access toward the file's download limit.

    Incremented on every ``chunk_url`` request (the one place a file is
    actually being fetched). When the count reaches the file's
    ``expire_after_n_download`` limit, a deletion is scheduled immediately
    (countdown=0) so the file is evicted right after this last allowed fetch
    completes -- mirroring the time-based one-shot path.
    """
    from apps.files.tasks import delete_file_after_expiry

    new_count, limit = await sync_to_async(_increment_download_count)(file_key)
    if limit and new_count >= limit:
        # The download-count limit has just been reached; remove the file
        # without waiting for a time-based expiry.
        delete_file_after_expiry.apply_async(args=[file_key], countdown=0)


def _delete_by_prefix(prefix: str) -> None:
    """List and delete all objects under *prefix*.

    A no-op when *prefix* holds nothing: deleting a missing file must be
    safe, and the filesystem backend raises on ``listdir`` for a path that
    does not exist (S3 returns empty instead).
    """
    storage = _storage()
    dir_path = prefix.rstrip("/")

    try:
        subdirs, files = storage.listdir(dir_path)
    except (OSError, FileNotFoundError):
        return

    for name in files:
        storage.delete(f"{dir_path}/{name}")

    for subdir in subdirs:
        storage.delete(f"{dir_path}/{subdir}")

    logger.debug("Deleted contents of %s", prefix)


async def file_chunks_exist(file_key: str, count: int) -> bool:
    """Check that all expected chunks are present in storage."""
    storage = _storage()
    for i in range(count):
        if not await sync_to_async(storage.exists)(chunk_key(file_key, i)):
            return False
    return True
