"""File model for uploaded file metadata."""

from django.db import models
from django.utils import timezone

from apps.files.validators import validate_download_count, validate_max_file_size
from mixins.models.fields import CreatedAtMixin, UUIDPrimaryKeyMixin


class File(UUIDPrimaryKeyMixin, CreatedAtMixin):
    """Uploaded file record."""

    key = models.CharField(max_length=1024, db_index=True)
    filename = models.CharField(max_length=500)
    expires_at = models.DateTimeField()
    expire_after_n_download = models.BigIntegerField(
        validators=[validate_download_count]
    )
    download_count = models.BigIntegerField(default=0)
    size = models.BigIntegerField(validators=[validate_max_file_size])
    number_of_files = models.IntegerField(null=True, blank=True)

    @property
    def is_expired(self) -> bool:
        """Check if the file has expired by time or download count."""
        return (
            timezone.now() >= self.expires_at
            or self.download_count >= self.expire_after_n_download
        )

    def __str__(self) -> str:
        return self.filename

    class Meta:
        ordering = ["-created_at"]
