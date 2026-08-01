import secrets
import uuid

from django.db import models
from django.utils import timezone


class Room(models.Model):
    """A reverse-file-share session."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    host_token = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    expire_after_n_download = models.IntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.host_token:
            self.host_token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    def __str__(self):
        return f"Room({self.name})"


class RoomFile(models.Model):
    """A file uploaded to a reverse-share room."""

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="files")
    key = models.CharField(max_length=1024, db_index=True)
    filename = models.CharField(max_length=500)
    size = models.BigIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["uploaded_at"]


class RoomHost(models.Model):
    """An authorized host for a room."""

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="hosts")
    host_token = models.CharField(max_length=64)

    class Meta:
        unique_together = ("room", "host_token")
