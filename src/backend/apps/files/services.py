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

import logging
from typing import TYPE_CHECKING

from asgiref.sync import sync_to_async
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

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


async def delete_file_chunks(file_key: str) -> None:
    """Delete every chunk of a file from storage."""
    await sync_to_async(_delete_by_prefix)(f"{file_key}/")


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
