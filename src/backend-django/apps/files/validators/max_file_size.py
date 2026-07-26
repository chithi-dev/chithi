from django.core.exceptions import ValidationError

from apps.config.models import Config


def validate_max_file_size(value: int) -> None:
    if value > Config.load().max_file_size_limit:
        raise ValidationError("File size exceeds the maximum allowed size.")
