import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional

from app.celery import celery
from app.deps import get_s3_client

logger = logging.getLogger(__name__)


async def _abort_multipart(bucket: str, key: str, upload_id: str) -> str:
    """Attempt a single abort and return a message on success.

    Any exceptions are logged and re-raised so Celery can retry according
    to the task configuration.
    """
    async for s3_client in get_s3_client():
        try:
            await s3_client.abort_multipart_upload(
                Bucket=bucket, Key=key, UploadId=upload_id
            )
            logger.info(
                "aborted_multipart",
                extra={
                    "bucket": bucket,
                    "key": key,
                    "upload_id": upload_id,
                },
            )
            return f"aborted multipart {key} {upload_id}"
        except Exception as exc:
            logger.exception(
                "abort_multipart_failed",
                extra={
                    "bucket": bucket,
                    "key": key,
                    "upload_id": upload_id,
                    "error": str(exc),
                },
            )
            raise
    logger.warning(
        "no_s3_client_available",
        extra={"bucket": bucket, "key": key, "upload_id": upload_id},
    )
    return "no s3 client available"


@celery.task(bind=True, max_retries=5, default_retry_delay=60)
def abort_multipart_upload_task(self, bucket: str, key: str, upload_id: str) -> str:
    """Celery task to abort a multipart upload with retries.

    Logs structured messages including retry attempt information so monitoring
    systems can pick up failed aborts.
    """
    retries = getattr(self.request, "retries", 0)
    logger.info(
        "abort_multipart_task_start",
        extra={
            "bucket": bucket,
            "key": key,
            "upload_id": upload_id,
            "attempt": retries + 1,
        },
    )
    try:
        result = asyncio.run(_abort_multipart(bucket, key, upload_id))
        logger.info(
            "abort_multipart_task_success",
            extra={"bucket": bucket, "key": key, "upload_id": upload_id},
        )
        return result
    except Exception as exc:
        retries = getattr(self.request, "retries", 0)
        logger.exception(
            "abort_multipart_task_failed",
            extra={
                "bucket": bucket,
                "key": key,
                "upload_id": upload_id,
                "attempt": retries + 1,
                "error": str(exc),
            },
        )
        # Re-raise to trigger Celery retry policy
        raise self.retry(exc=exc)


async def _list_incomplete_uploads(
    bucket: str, prefix: Optional[str] = None
) -> List[Dict]:
    """Return list of multipart uploads (UploadId, Key, Initiated datetime).

    This uses pagination to retrieve all current multipart uploads for the
    bucket (optionally filtered by prefix).
    """
    uploads: List[Dict] = []
    async for s3_client in get_s3_client():
        key_marker = None
        upload_id_marker = None
        while True:
            params: Dict = {"Bucket": bucket}
            if prefix:
                params["Prefix"] = prefix
            if key_marker:
                params["KeyMarker"] = key_marker
            if upload_id_marker:
                params["UploadIdMarker"] = upload_id_marker
            resp = await s3_client.list_multipart_uploads(**params)
            for u in resp.get("Uploads", []) or []:
                initiated = u.get("Initiated")
                # Botocore returns datetime objects for Initiated
                uploads.append(
                    {
                        "Key": u.get("Key"),
                        "UploadId": u.get("UploadId"),
                        "Initiated": initiated,
                    }
                )
            # Pagination
            if resp.get("IsTruncated"):
                key_marker = resp.get("NextKeyMarker")
                upload_id_marker = resp.get("NextUploadIdMarker")
                continue
            break
    logger.info(
        "list_incomplete_uploads",
        extra={"bucket": bucket, "count": len(uploads), "prefix": prefix},
    )
    return uploads


@celery.task(bind=True)
def abort_stale_multipart_uploads_task(
    self, bucket: str, older_than_hours: int = 24, prefix: Optional[str] = None
) -> Dict:
    """Scan and abort multipart uploads older than `older_than_hours`.

    Returns a summary dictionary with counts for logging and monitoring.
    """
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(hours=older_than_hours)

    logger.info(
        "abort_stale_multipart_start",
        extra={"bucket": bucket, "threshold": threshold.isoformat(), "prefix": prefix},
    )

    try:
        uploads = asyncio.run(_list_incomplete_uploads(bucket, prefix=prefix))
    except Exception as exc:
        logger.exception(
            "abort_stale_list_failed", extra={"bucket": bucket, "error": str(exc)}
        )
        raise

    total = 0
    aborted = 0
    failed = 0
    for u in uploads:
        total += 1
        initiated = u.get("Initiated")
        if not initiated or initiated > threshold:
            continue
        key = u["Key"]
        upload_id = u["UploadId"]
        try:
            asyncio.run(_abort_multipart(bucket, key, upload_id))
            aborted += 1
        except Exception as exc:
            failed += 1
            logger.exception(
                "abort_stale_failed",
                extra={
                    "bucket": bucket,
                    "key": key,
                    "upload_id": upload_id,
                    "error": str(exc),
                },
            )

    summary = {
        "bucket": bucket,
        "total_found": total,
        "aborted": aborted,
        "failed": failed,
    }
    logger.info("abort_stale_multipart_complete", extra=summary)
    return summary
