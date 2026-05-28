"""Custom django-storages S3 backend wrapper.

Extends the default S3Storage to add chunked upload support for large files,
matching FastAPI's 8MB multipart chunk size behavior.
"""

from __future__ import annotations

import logging
from typing import Any

from storages.backends.s3boto3 import S3Boto3Storage


logger = logging.getLogger(__name__)


class ChunksS3Storage(S3Boto3Storage):
    """S3 storage backend with chunked multipart uploads for large files."""

    # Multipart upload size threshold (8 MB per chunk, matching S3 spec)
    multipart_chunk_size: int = 8 * 1024 * 1024

    def __init__(self, **kwargs: Any):
        super().__init__(**kwargs)
        self.default_acl = None  # private by default
