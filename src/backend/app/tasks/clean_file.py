import asyncio
from uuid import UUID

from botocore.exceptions import ClientError
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

        try:
            async for s3_client in get_s3_client():
                await s3_client.delete_object(
                    Bucket=settings.RUSTFS_BUCKET_NAME,
                    Key=file_obj.key,
                )
        except ClientError as e:
            # Check for specific S3 error codes
            error_response = e.response.get("Error", {})
            error_code = error_response.get("Code", "Unknown")
            if error_code == "NoSuchKey":
                print(f"File {file_obj.key} was already gone from S3.")
            else:
                raise e

        # Delete from DB
        await session.delete(file_obj)
        await session.commit()
        return f"File {file_id} deleted"


@celery.task
def delete_expired_file(file_id: str):
    return asyncio.run(_delete_file(UUID(file_id)))
