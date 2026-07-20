"""Validator: expiry duration must be in the configured time_configs."""

from django.core.exceptions import ValidationError

from apps.config.models import Config


def validate_expiry_duration(value: int) -> None:
    config = Config.load()
    if config.time_configs and value not in config.time_configs:
        raise ValidationError(f"Expiry duration is not in the allowed configurations.")
