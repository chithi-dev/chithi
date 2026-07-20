"""S3 / RUSTFS service layer for file storage operations."""

import logging

import boto3
from botocore.exceptions import ClientError
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_s3_client() -> boto3.client:
    """Create and return an S3 client configured with project settings."""
    return boto3.client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def upload_file_data(key: str, data: bytes) -> bool:
    """Upload raw bytes to S3 under the given key."""
    s3 = _get_s3_client()
    try:
        s3.put_object(
            Bucket=settings.AWS_STORAGE_BUCKET_NAME,
            Key=key,
            Body=data,
        )
        return True
    except ClientError as e:
        logger.error(f"Failed to upload file {key} to S3: {e}")
        return False


def download_file_data(key: str) -> bytes | None:
    """Download file contents from S3 by key. Returns None if not found."""
    s3 = _get_s3_client()
    try:
        response = s3.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
        return response["Body"].read()
    except ClientError as e:
        logger.error(f"Failed to download file {key} from S3: {e}")
        return None


def delete_file_from_s3(key: str) -> bool:
    """Delete a file from S3 by key. Returns True if deleted or already absent."""
    s3 = _get_s3_client()
    try:
        s3.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
        return True
    except ClientError as e:
        logger.error(f"Failed to delete file {key} from S3: {e}")
        return False


def get_presigned_upload_url(key: str, expires_in: int = 3600) -> str:
    """Return a presigned URL for uploading a file directly to S3."""
    s3 = _get_s3_client()
    return s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
            "Key": key,
        },
        ExpiresIn=expires_in,
    )


def get_presigned_download_url(key: str, expires_in: int = 3600) -> str:
    """Return a presigned URL for downloading a file directly from S3."""
    s3 = _get_s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
            "Key": key,
        },
        ExpiresIn=expires_in,
    )


def file_exists(key: str) -> bool:
    """Check if a file exists in S3."""
    s3 = _get_s3_client()
    try:
        s3.head_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
        return True
    except ClientError:
        return False
