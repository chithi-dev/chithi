"""Storage service - S3-compatible object storage with chunked upload.

Architecture (per project requirements):
- **Upload**: the frontend splits the encrypted payload into 50 MB chunks and
  uploads each chunk through a GraphQL mutation. Django streams each chunk to
  S3 as a separate object under ``{file_key}/chunk-{index}``.
- **Download**: the frontend fetches each chunk **directly from S3** using
  presigned URLs (S3 sits behind Cloudflare), then reassembles and decrypts.
  Django is not in the download hot path.

If S3 is not configured, a local-filesystem fallback keeps the same object-key
layout so the rest of the app (and the frontend chunk contract) is unchanged.
"""

import io
import logging
import os
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

# 50 MB chunk size - the unit of upload/download. Must match the frontend.
CHUNK_SIZE_BYTES = 50 * 1024 * 1024


def chunk_key(file_key: str, index: int) -> str:
    """S3 object key for a single chunk of a file."""
    return f"{file_key}/chunk-{index}"


def is_s3_backend() -> bool:
    """True if S3 credentials + bucket are configured."""
    return bool(
        getattr(settings, "AWS_ACCESS_KEY_ID", "")
        and getattr(settings, "AWS_SECRET_ACCESS_KEY", "")
        and getattr(settings, "AWS_STORAGE_BUCKET_NAME", "")
    )


# ---------------------------------------------------------------------------
# S3 client (lazy - aioboto3 only imported when S3 is actually used)
# ---------------------------------------------------------------------------


def _s3_resource():
    import aioboto3

    return aioboto3.resource(
        "s3",
        endpoint_url=getattr(settings, "AWS_S3_ENDPOINT_URL", None) or None,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,  # type: ignore[attr-defined]
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,  # type: ignore[attr-defined]
    )


def _s3_client():
    import aioboto3

    return aioboto3.client(
        "s3",
        endpoint_url=getattr(settings, "AWS_S3_ENDPOINT_URL", None) or None,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,  # type: ignore[attr-defined]
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,  # type: ignore[attr-defined]
    )


# ---------------------------------------------------------------------------
# Local-filesystem fallback (same object-key layout)
# ---------------------------------------------------------------------------


class _LocalStore:
    """Local-filesystem stand-in for S3, used when S3 is not configured."""

    def __init__(self) -> None:
        self.root = Path(settings.MEDIA_ROOT)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return self.root / key

    async def put(self, key: str, data: bytes) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    async def presigned_get_url(self, key: str, expires_in: int) -> str:
        # Local files are served by Django at MEDIA_URL (DEBUG) or a CDN (prod).
        # A relative URL keeps the client free to prepend its own origin.
        media_url = getattr(settings, "MEDIA_URL", "/media/")
        return f"{media_url.rstrip('/')}/{key}/"

    async def delete_prefix(self, prefix: str) -> None:
        base = self._path(prefix)
        if base.is_dir():
            for child in sorted(base.rglob("*"), reverse=True):
                if child.is_file():
                    child.unlink()
            base.rmdir()


# ---------------------------------------------------------------------------
# Public storage API
# ---------------------------------------------------------------------------


async def upload_chunk(file_key: str, index: int, data: bytes) -> None:
    """Upload a single chunk (<= 50 MB) to storage."""
    key = chunk_key(file_key, index)
    if is_s3_backend():
        res = _s3_resource()
        async with res as s3:
            await s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).put(Body=data)  # type: ignore[attr-defined]
    else:
        await _LocalStore().put(key, data)
    logger.debug("Uploaded chunk %s/%d (%d bytes)", file_key, index, len(data))


async def presigned_chunk_url(file_key: str, index: int, expires_in: int = 3600) -> str:
    """Return a URL the frontend can use to fetch one chunk directly."""
    key = chunk_key(file_key, index)
    if is_s3_backend():
        client = _s3_client()
        async with client as s3:
            return await s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": key},  # type: ignore[attr-defined]
                ExpiresIn=expires_in,
            )
    return await _LocalStore().presigned_get_url(key, expires_in)


async def delete_file_chunks(file_key: str) -> None:
    """Delete every chunk of a file from storage."""
    if is_s3_backend():
        res = _s3_resource()
        async with res as s3:
            client = s3.meta.client
            prefix = f"{file_key}/"
            # List all chunks then delete in a single batch (max 1000 keys).
            resp = await client.list_objects_v2(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME, Prefix=prefix  # type: ignore[attr-defined]
            )
            contents = resp.get("Contents", [])
            if contents:
                await client.delete_objects(
                    Bucket=settings.AWS_STORAGE_BUCKET_NAME,  # type: ignore[attr-defined]
                    Delete={"Objects": [{"Key": obj["Key"]} for obj in contents]},
                )
    else:
        await _LocalStore().delete_prefix(f"{file_key}/")


async def file_chunks_exist(file_key: str, count: int) -> bool:
    """Check that all expected chunks are present in storage."""
    if is_s3_backend():
        res = _s3_resource()
        async with res as s3:
            for i in range(count):
                obj = s3.Object(settings.AWS_STORAGE_BUCKET_NAME, chunk_key(file_key, i))  # type: ignore[attr-defined]
                if not await obj.metadata():
                    return False
            return True
    store = _LocalStore()
    return all(store._path(chunk_key(file_key, i)).exists() for i in range(count))
