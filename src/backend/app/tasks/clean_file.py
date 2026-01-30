import asyncio
from uuid import UUID

from sqlmodel import select

from app.celery import celery
from app.db import AsyncSessionLocal
from app.deps import get_s3_client
from app.models.files import File
from app.settings import settings


async def _delete_file(file_id: UUID):
    async with AsyncSessionLocal() as session:
        statement = select(File).where(File.id == file_id)
        result = await session.exec(statement)
        file_obj = result.one_or_none()

        if not file_obj:
            return f"File {file_id} not found"

        async for s3_client in get_s3_client():
            await s3_client.delete_object(
                Bucket=settings.RUSTFS_BUCKET_NAME,
                Key=file_obj.key,
            )

        # Delete from DB
        await session.delete(file_obj)
        await session.commit()
        return f"File {file_id} deleted"


@celery.task
def delete_expired_file(file_id: str):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_delete_file(UUID(file_id)))
    finally:
        loop.close()
