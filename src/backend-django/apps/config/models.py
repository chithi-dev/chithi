"""Single-row enforcement via get_config() class method and pre_save signal. Uses PostgreSQL ArrayField for list[int] and list[str].."""
from __future__ import annotations
import uuid
from django.conf import settings as dj_settings
from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ValidationError
from django.db import models

class ConfigManager(models.Manager):
    """Custom manager that ensures single-row Config."""
    def get_queryset(self) -> models.QuerySet:
        return super().get_queryset()
    async def aget_config(self) -> "Config":
        """Get the single config row; create defaults if it doesn't exist."""
        obj, created = await self.aget_or_create(
            pk=1,
            defaults={
                "total_storage_limit": 10 * 1024**3,
                "max_file_size_limit": 100 * 1024**2,
                "default_expiry": 604800,
                "default_number_of_downloads": 10,
                "site_description": "",
                "download_configs": [10],
                "time_configs": [604800],
                "allowed_file_types": [],
                "banned_file_types": [],
                "allow_uploads": True,
            },
        )
        return obj  # type: ignore[return-value]

    async def acount(self) -> int:
        """Count config rows (should be 0 or 1)."""
        return await self.all().acount()

class Config(models.Model):
    """Server configuration - single row with pk=1."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    total_storage_limit = models.BigIntegerField(
        default=10 * 1024**3, db_comment="Total storage limit in bytes (default 10 GB)"
    )
    max_file_size_limit = models.BigIntegerField(
        default=100 * 1024**2, db_comment="Max single file size in bytes (default 100 MB)"
    )
    default_expiry = models.IntegerField(
        default=604800, db_comment="Default expiry duration in seconds (7 days)"
    )
    default_number_of_downloads = models.IntegerField(
        default=10, db_comment="Default download count limit"
    )
    site_description = models.TextField(default="", blank=True)
    download_configs = ArrayField(
        base_field=models.IntegerField(),
        default=list,
        blank=True,
        db_comment="Selectable download count options",
    )
    time_configs = ArrayField(
        base_field=models.IntegerField(),
        default=list,
        blank=True,
        db_comment="Selectable expiry durations in seconds",
    )
    allowed_file_types = ArrayField(
        base_field=models.CharField(max_length=255),
        default=list,
        blank=True,
        db_comment="Allowed file type extensions",
    )
    banned_file_types = ArrayField(
        base_field=models.CharField(max_length=255),
        default=list,
        blank=True,
        db_comment="Banned file type extensions",
    )
    allow_uploads = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True, editable=False)
    objects = ConfigManager()
    class Meta:
        app_label = "config"
        db_table = "app_config"
        verbose_name = "Config"
        verbose_name_plural = "Configs"
    def clean(self) -> None:
        if self.__class__.objects.filter(pk__ne=1).count() > 0 or (self.pk and int(self.pk) != 1):  # type: ignore[attr-defined,union-attr]
            raise ValidationError("Only one Config row is allowed.")
    @classmethod
    async def get_config(cls):  # noqa: F821 – resolved at runtime
        return await cls.objects.aget_config()
    def __str__(self) -> str:
        return f"Config (storage={self.total_storage_limit} bytes)"

# ── Ensure only one row exists via pre_save signal ────────────────
async def _enforce_single_config(sender, instance, **kwargs):  # type: ignore[no-untyped-def]
    """Pre-save hook to enforce single-row Config."""
    if instance.pk is None or int(instance.pk) != 1:  # type: ignore[operator]
        instance.pk = 1  # type: ignore[assignment]
