from datetime import datetime, timezone

import anyio
from sqlmodel import or_, select

from app.celery import celery
from app.db import AsyncSessionLocal
from app.models.files import File
from app.tasks.clean_file import delete_expired_file


async def _find_and_enqueue_expired():
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        statement = select(File.id).where(
            or_(
                File.download_count >= File.expire_after_n_download,
                File.expires_at < now,
            )
        )
        result = await session.exec(statement)
        ids = result.all()

    for file_id in ids:
        # enqueue deletion tasks
        delete_expired_file.delay(str(file_id))

    return {"enqueued": len(ids)}


@celery.task
def cleanup_expired_files():
    """Periodic task: find expired files and enqueue deletion tasks."""
    return anyio.run(_find_and_enqueue_expired)


__all__ = ["cleanup_expired_files"]
