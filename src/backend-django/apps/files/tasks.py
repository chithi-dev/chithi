import logging

from django.db.models import Q
from django.tasks import task

logger = logging.getLogger(__name__)


@task()
async def delete_file_storage_task(storage_key: str) -> None:
    """Delete file from S3/RustFS storage after DB record deletion."""
    logger.info("Deleting file from storage: %s", storage_key)
    try:
        from core.storage.services import StorageService

        deleted = StorageService.delete(storage_key)  # type: ignore[attr-defined]
        logger.info(
            "Deleted file %s from storage: %s",
            storage_key,
            "ok" if deleted else "failed",
        )
    except Exception:
        logger.error(
            "Failed to delete file %s from storage", storage_key, exc_info=True
        )


@task()
async def cleanup_expired_files_task() -> None:
    """Scheduled task to clean up expired files."""
    from apps.files.models import FileRecord
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    from django.db.models import F

    try:
        deleted_count = await FileRecord.objects.filter(
            Q(expires_at__lt=now) | Q(download_count__gte=F("expire_after_n_download"))
        ).adelete()  # type: ignore[name-defined]
        logger.info("Cleaned up %d expired files", deleted_count[0])
    except Exception:
        logger.error("Error cleaning up expired files", exc_info=True)


@task()
async def delete_expired_file_by_id(file_id: str) -> None:
    """Delete a specific file by ID (matches FastAPI's Celery task)."""
    from apps.files.models import FileRecord
    from uuid import UUID

    try:
        record = await FileRecord.objects.aget(id=UUID(file_id))  # type: ignore[arg-type]
    except FileRecord.DoesNotExist:
        logger.info("File %s not found for deletion", file_id)
        return

    storage_key = record.key
    await delete_file_storage_task.aenqueue(storage_key)
    await record.adelete()
    logger.info("Deleted expired file %s (key=%s)", file_id, storage_key)
