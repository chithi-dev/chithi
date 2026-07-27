import os
import io
import aioboto3
from django.conf import settings


def _get_s3_resource():
    return aioboto3.resource(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name="us-east-1",
    )


def _get_s3_client():
    return aioboto3.client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name="us-east-1",
    )


async def upload_file_data(key: str, data: bytes) -> None:
    """Upload bytes to S3."""
    resource = _get_s3_resource()
    async with resource as s3:
        await s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).put(Body=data)


async def upload_file_stream(key: str, stream: io.BytesIO, size: int) -> None:
    """Upload a stream to S3 without loading entire file into memory."""
    resource = _get_s3_resource()
    async with resource as s3:
        await s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).put(
            Body=stream,
            ContentLength=size,
        )


async def download_file_data(key: str) -> bytes:
    """Download file from S3 and return bytes."""
    resource = _get_s3_resource()
    async with resource as s3:
        obj = await s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).get()
        stream = obj["Body"]
        data = await stream.read()
        return data


async def download_file_stream(key: str):
    """Download file from S3 and return the response stream for streaming."""
    resource = _get_s3_resource()
    async with resource as s3:
        obj = await s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).get()
        return obj["Body"]


async def delete_file_from_s3(key: str) -> None:
    """Delete a file from S3."""
    resource = _get_s3_resource()
    async with resource as s3:
        await s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).delete()


async def get_presigned_upload_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for uploading."""
    resource = _get_s3_resource()
    async with resource as s3:
        url = await s3.meta.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
                "Key": key,
            },
            ExpiresIn=expires_in,
        )
        return url


async def get_presigned_download_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for downloading."""
    resource = _get_s3_resource()
    async with resource as s3:
        url = await s3.meta.client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
                "Key": key,
            },
            ExpiresIn=expires_in,
        )
        return url


async def file_exists(key: str) -> bool:
    """Check if a file exists in S3."""
    resource = _get_s3_resource()
    async with resource as s3:
        try:
            await s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).load()
            return True
        except Exception:
            return False
