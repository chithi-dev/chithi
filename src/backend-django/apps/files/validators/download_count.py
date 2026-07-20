"""Validator: download count must be in the configured download_configs."""

from django.core.exceptions import ValidationError

from apps.config.models import Config


def validate_download_count(value: int) -> None:
    config = Config.load()
    if config.download_configs and value not in config.download_configs:
        raise ValidationError("Download count is not in the allowed configurations.")
