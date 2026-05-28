import uuid


from django.db import models


class Room(models.Model):
    """A temporary room that holds files with an expiry."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, db_comment="Room display name")
    expire_after = models.IntegerField(
        db_comment="Seconds until room expires after creation"
    )
    number_of_downloads = models.IntegerField(
        null=True, blank=True, db_comment="Optional per-file download limit"
    )
    created_at = models.DateTimeField(auto_now_add=True, editable=False)
    expires_at = models.DateTimeField()

    class Meta:
        app_label = "reverse_rooms"
        db_table = "reverse_rooms_room"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["expires_at"], name="idx_rr_expires"),
        ]

    def __str__(self) -> str:
        return f"Room({self.id}) - {self.name}"


class RoomFile(models.Model):
    """A file uploaded inside a reverse room."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="files")
    key = models.CharField(max_length=255, db_comment="S3 storage key")
    filename = models.CharField(max_length=255, db_comment="Original filename")
    size = models.BigIntegerField(db_comment="File size in bytes")
    uploaded_at = models.DateTimeField(auto_now_add=True, editable=False)

    class Meta:
        app_label = "reverse_rooms"
        db_table = "reverse_rooms_file"
        ordering = ["-uploaded_at"]

    def __str__(self) -> str:
        return f"{self.filename} ({self.size} bytes)"


class RoomHost(models.Model):
    """A host token for a room (SHA-256 hash of the raw token)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="hosts")
    host_token = models.CharField(
        max_length=64, db_comment="SHA-256 hash of host token"
    )
    created_at = models.DateTimeField(auto_now_add=True, editable=False)

    class Meta:
        app_label = "reverse_rooms"
        db_table = "reverse_rooms_host"
        indexes = [
            models.Index(fields=["room", "host_token"], name="idx_rr_room_hash"),
        ]

    def __str__(self) -> str:
        return f"Host({self.room_id} - {self.host_token[:16]}...)"
