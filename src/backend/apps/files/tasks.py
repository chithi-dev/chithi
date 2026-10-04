import logging

from asgiref.sync import sync_to_async
from django.tasks import task
from django.utils import timezone

from apps.files.services import delete_file_chunks
from apps.files.models import File

logger = logging.getLogger(__name__)


@task
async def delete_expired_files() -> int:
    """Delete expired files from storage and the database.

    Uses the configured storage backend (local or S3) via services.py,
    ensuring consistent behavior across environments.
    """
    now = timezone.now()
    expired_files = await sync_to_async(list)(
        File.objects.filter(expires_at__lte=now)
    )
    count = 0

    for file_obj in expired_files:
        try:
            await delete_file_chunks(file_obj.key)
        except Exception as e:
            logger.error("Failed to delete file %s: %s", file_obj.key, e)
        await sync_to_async(file_obj.delete)()
        count += 1

    return count
