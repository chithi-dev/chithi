"""Storage service layer for file operations.

Uses Django's default storage backend (configured via django-storages)
so the code is backend-agnostic and testable.
"""

import logging

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)


def upload_file_data(key: str, data: bytes) -> bool:
    """Upload raw bytes under the given key via the default storage backend."""
    try:
        default_storage.save(key, ContentFile(data))
        return True
    except Exception as e:
        logger.error("Failed to upload file %s: %s", key, e)
        return False


def download_file_data(key: str) -> bytes | None:
    """Download file contents by key. Returns None if not found."""
    try:
        with default_storage.open(key, "rb") as f:
            return f.read()
    except Exception as e:
        logger.error("Failed to download file %s: %s", key, e)
        return None


def delete_file_from_s3(key: str) -> bool:
    """Delete a file by key. Returns True if deleted or already absent."""
    try:
        if default_storage.exists(key):
            default_storage.delete(key)
        return True
    except Exception as e:
        logger.error("Failed to delete file %s: %s", key, e)
        return False


def file_exists(key: str) -> bool:
    """Check if a file exists."""
    try:
        return default_storage.exists(key)
    except Exception:
        return False
