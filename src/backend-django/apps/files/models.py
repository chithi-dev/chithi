from django.db import models
from django.utils import timezone

from mixins.models.fields import CreatedAtMixin, UUIDPrimaryKeyMixin


class File(UUIDPrimaryKeyMixin, CreatedAtMixin):
    key = models.CharField(max_length=1024, db_index=True)
    filename = models.CharField(max_length=500)
    expires_at = models.DateTimeField()
    expire_after_n_download = models.BigIntegerField()
    download_count = models.BigIntegerField(default=0)
    size = models.BigIntegerField()
    number_of_files = models.IntegerField(null=True, blank=True)

    @property
    def is_expired(self) -> bool:
        """Check if the file has expired by time or download count."""
        if timezone.now() >= self.expires_at:
            return True
        if self.download_count >= self.expire_after_n_download:
            return True
        return False

    def __str__(self) -> str:
        return self.filename

    class Meta:
        ordering = ["-created_at"]
