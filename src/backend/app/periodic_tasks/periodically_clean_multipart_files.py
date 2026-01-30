import logging
from datetime import datetime, timedelta, timezone

import anyio

from app.celery import celery
from app.deps import get_s3_client

logger = logging.getLogger(__name__)

MAX_AGE = timedelta(hours=6)


async def _cleanup(bucket: str):
    now = datetime.now(timezone.utc)
    async with get_s3_client() as s3:
        paginator = s3.get_paginator("list_multipart_uploads")
        async for page in paginator.paginate(Bucket=bucket):
            for upload in page.get("Uploads", []):
                # Keys in MultipartUploadTypeDef are optional; use .get and skip incomplete entries
                initiated = upload.get("Initiated")
                key = upload.get("Key")
                upload_id = upload.get("UploadId")

                if not (initiated and key and upload_id):
                    logger.debug("Skipping incomplete upload entry: %s", upload)
                    continue

                if now - initiated > MAX_AGE:
                    await s3.abort_multipart_upload(
                        Bucket=bucket,
                        Key=key,
                        UploadId=upload_id,
                    )
                    logger.info("Aborted multipart upload: %s (%s)", key, upload_id)


@celery.task(
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 5},
)
def cleanup_stalled_multipart_uploads(bucket: str):
    anyio.run(_cleanup, bucket)


__all__ = ["cleanup_stalled_multipart_uploads"]
