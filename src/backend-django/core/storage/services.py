"""Storage service layer — all file operations flow through here.

Uses django-storages S3 backend. GraphQL resolvers and app services call this layer,
never interact with storages.backends directly.
"""

from __future__ import annotations

import io
import logging
from typing import BinaryIO

from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)


class StorageService:
    """High-level cloud storage operations via django-storages."""

    @staticmethod
    def upload(key: str, data: bytes | BinaryIO) -> bool:
        """Upload *data* to *key* in cloud storage. Returns True on success."""
        try:
            if isinstance(data, bytes):
                stream = io.BytesIO(data)
            else:
                stream = data
            default_storage.save(key, stream)  # type: ignore[arg-type]
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("Storage upload failed for key=%s: %s", key, exc)
            raise

    @staticmethod
    def download(key: str) -> bytes | None:
        """Download and return file contents from *key*. Returns None on failure."""
        try:
            if not default_storage.exists(key):  # type: ignore[attr-defined]
                return None
            with default_storage.open(key, "rb") as f:  # type: ignore[attr-defined]
                return f.read()
        except Exception as exc:  # noqa: BLE001
            logger.error("Storage download failed for key=%s: %s", key, exc)
            return None

    @staticmethod
    def delete(key: str) -> bool:
        """Delete *key* from cloud storage. Returns True on success."""
        try:
            default_storage.delete(key)  # type: ignore[attr-defined]
            return True
        except Exception as exc:  # noqa: BLE001
            logger.error("Storage delete failed for key=%s: %s", key, exc)
            return False

    @staticmethod
    def exists(key: str) -> bool:
        """Check whether *key* exists in cloud storage."""
        try:
            return default_storage.exists(key)  # type: ignore[attr-defined]
        except Exception:
            return False

    @staticmethod
    def size(key: str) -> int | None:
        """Return file size in bytes for *key*, or None if not found."""
        try:
            return default_storage.size(key)  # type: ignore[attr-defined]
        except Exception:
            return None

    @staticmethod
    def stream_file_iterator(key: str, chunk_size: int = 8192):
        """Yield chunks of file data for streaming responses.

        Used by Django StreamingHttpResponse to pipe S3 data through the backend
        without loading entire file into memory or exposing presigned URLs.
        """
        try:
            if not default_storage.exists(key):  # type: ignore[attr-defined]
                return
            with default_storage.open(key, "rb") as f:  # type: ignore[attr-defined]
                while chunk := f.read(chunk_size):
                    yield chunk
        except Exception as exc:  # noqa: BLE001
            logger.error("Storage stream failed for key=%s: %s", key, exc)
