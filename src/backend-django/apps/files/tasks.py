import logging

from boto3 import client
from botocore.exceptions import ClientError
from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import File

logger = logging.getLogger(__name__)


@shared_task()
def delete_expired_files() -> str:
    """Delete expired files from S3 and the database."""
    now = timezone.now()
    expired_files = File.objects.filter(expires_at__lt=now)
    count = 0

    s3_client = client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )

    for file_obj in expired_files:
        try:
            s3_client.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=file_obj.key)
        except ClientError as e:
            logger.error(f"Failed to delete S3 object {file_obj.key}: {e}")
        file_obj.delete()
        count += 1

    return f"Deleted {count} expired files."
