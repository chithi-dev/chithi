"""Celery tasks for file management."""

import logging

from celery import shared_task
from django.core.files.storage import default_storage
from django.utils import timezone

from .models import File

logger = logging.getLogger(__name__)


@shared_task()
def delete_expired_files() -> str:
    """Delete expired files from storage and the database."""
    now = timezone.now()
    expired_files = File.objects.filter(expires_at__lt=now)
    count = 0

    for file_obj in expired_files:
        try:
            if default_storage.exists(file_obj.key):
                default_storage.delete(file_obj.key)
        except Exception as e:
            logger.error("Failed to delete file %s: %s", file_obj.key, e)
        file_obj.delete()
        count += 1

    return f"Deleted {count} expired files."
