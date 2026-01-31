from datetime import datetime, timezone
from uuid import UUID

from sqlmodel import or_, select

from app.celery import celery
from app.db import AsyncSessionLocal
from app.deps import get_s3_client
from app.models.files import File
from app.settings import settings


async def _delete_file(file_id: UUID):
    async with AsyncSessionLocal() as session:
        now = datetime.now(timezone.utc)

        statement = select(File).where(
            or_(
                File.id == file_id,
                File.download_count >= File.expire_after_n_download,
                File.expires_at < now,
            )
        )
        result = await session.exec(statement)
        files_to_delete = result.all()

        if not files_to_delete:
            return "No files found to delete."

        # Process deletions
        async for s3_client in get_s3_client():
            for file_obj in files_to_delete:
                try:
                    # Remove from S3
                    await s3_client.delete_object(
                        Bucket=settings.RUSTFS_BUCKET_NAME,
                        Key=file_obj.key,
                    )
                    # Remove from Session
                    await session.delete(file_obj)
                except Exception as e:
                    # If one file fails (e.g. S3 404), continue to others
                    print(f"Excetpion raised while deleting: {e}")
                    continue

        # Commit all changes
        await session.commit()
        return f"Processed {len(files_to_delete)} deletions."


@celery.task
def delete_expired_file(file_id: str):
    import anyio

    anyio.run(_delete_file, UUID(file_id))
