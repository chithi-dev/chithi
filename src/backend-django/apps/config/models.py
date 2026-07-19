from django.db import models

from mixins.models.base.singleton import SingletonModel


class Config(SingletonModel):
    total_storage_limit = models.BigIntegerField(default=10 * 1024 * 1024 * 1024)
    max_file_size_limit = models.BigIntegerField(default=100 * 1024 * 1024)
    default_expiry = models.BigIntegerField(default=7 * 24 * 3600)
    default_number_of_downloads = models.IntegerField(default=10)
    site_description = models.TextField(default="Secure file sharing service")
    download_configs = models.BigIntegerArrayField(default=list)
    time_configs = models.BigIntegerArrayField(default=list)
    allowed_file_types = models.ArrayField(models.TextField(), default=list)
    banned_file_types = models.ArrayField(models.TextField(), default=list)
    allow_uploads = models.BooleanField(default=True)

    def __str__(self) -> str:
        return "Site Configuration"
