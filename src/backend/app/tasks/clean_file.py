import asyncio
from uuid import UUID

import aioboto3
from sqlmodel import select

from app.celery import celery
from app.db import AsyncSessionLocal
from app.models.files import File
from app.settings import settings


async def _delete_file(file_id: UUID):
    async with AsyncSessionLocal() as session:
        # Fetch the file
        statement = select(File).where(File.id == file_id)
        result = await session.exec(statement)
        file_obj = result.first()

        if not file_obj:
            return f"File {file_id} not found"

        # Delete from S3
        session_s3 = aioboto3.Session()
        async with session_s3.client(
            "s3",
            endpoint_url=settings.RUSTFS_ENDPOINT_URL,
            aws_access_key_id=settings.RUSTFS_ACCESS_KEY,
            aws_secret_access_key=settings.RUSTFS_SECRET_ACCESS_KEY,
        ) as s3_client:
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
    return asyncio.run(_delete_file(UUID(file_id)))
