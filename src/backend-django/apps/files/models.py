"""Django FileRecord model."""

from __future__ import annotations

import datetime
from uuid import uuid4

from django.db import models


class FileRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    key = models.CharField(max_length=512, db_comment="S3 storage key")
    filename = models.CharField(max_length=1024, db_comment="Original filename")
    size = models.BigIntegerField(db_comment="File size in bytes")
    expires_at = models.DateTimeField(
        db_comment="Expiration timestamp (UTC)"
    )
    expire_after_n_download = models.BigIntegerField(
        default=0, db_comment="Download count limit (0 = unlimited)"
    )
    download_count = models.BigIntegerField(default=0, db_comment="Current download count")
    number_of_files = models.IntegerField(null=True, blank=True, default=1, db_comment="For folder/archive uploads")

    created_at = models.DateTimeField(auto_now_add=True, db_comment="Creation timestamp (UTC)")

    class Meta:
        app_label = "files"
        db_table = "files_file"
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["key", "filename"], name="idx_files_key_filename"),
        ]

    def __str__(self) -> str:
        return f"{self.filename} ({self.size} bytes)"

    @property
    def is_expired(self) -> bool:
        now = datetime.datetime.now(datetime.timezone.utc)
        if now > self.expires_at:
            return True
        if self.expire_after_n_download and self.download_count >= self.expire_after_n_download:
            return True
        return False

    @property
    def expires_in_seconds(self) -> int | None:
        delta = self.expires_at - datetime.datetime.now(datetime.timezone.utc)
        secs = int(delta.total_seconds())
        return max(0, secs) if secs > 0 else 0

    @property
    def downloads_remaining(self) -> int | None:
        if not self.expire_after_n_download:
            return None
        return max(0, self.expire_after_n_download - self.download_count)
