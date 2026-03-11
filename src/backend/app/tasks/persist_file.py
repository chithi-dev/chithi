from datetime import datetime

from app.celery import celery
from app.db import AsyncSessionLocal
from app.models.files import File
from app.tasks.clean_file import delete_expired_file


@celery.task
async def persist_file_record(
    key: str,
    filename: str,
    size: int,
    created_at: str,
    expires_at: str,
    content_type: str,
) -> str:
    """Create a File record in the DB and schedule its cleanup.

    Runs as a Celery background task so the upload HTTP response is not
    blocked by database I/O.
    """
    created = datetime.fromisoformat(created_at)
    expires = datetime.fromisoformat(expires_at)

    file_record = File(
        key=key,
        filename=filename,
        size=size,
        created_at=created,
        expires_at=expires,
        expire_after_n_download=2**31 - 1,  # effectively unlimited
        download_count=0,
    )

    async with AsyncSessionLocal() as session:
        session.add(file_record)
        await session.commit()
        await session.refresh(file_record)

        # Schedule file cleanup at expiry
        delete_expired_file.apply_async((str(file_record.id),), eta=expires)

    return str(file_record.id)
