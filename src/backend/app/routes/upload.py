import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, cast

from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, Request
from sqlmodel import select

from app.deps import S3Dep, SessionDep
from app.models.config import Config
from app.models.files import File, FileOut
from app.settings import settings
from app.tasks.clean_file import delete_expired_file

logger = logging.getLogger(__name__)
router = APIRouter()


async def get_storage_usage(session: SessionDep) -> int:
    """Calculates used storage based on database records."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    query = select(File).where(File.expires_at > now)
    result = await session.exec(query)
    return sum(f.size for f in result.all())


@router.post("/upload")
async def upload_file(
    request: Request,
    filename: Annotated[str | None, Form()],
    expire_after_n_download: Annotated[int, Form()],
    expire_after: Annotated[int, Form()],
    s3: S3Dep,
    session: SessionDep,
    background: BackgroundTasks,
) -> FileOut:
    # 1. Configuration & Validation
    config = (await session.exec(select(Config))).first()
    if not config:
        raise HTTPException(status_code=503, detail="System not configured")

    # 2. Check Quota BEFORE stream begins
    current_used = await get_storage_usage(session)
    if config.total_storage_limit and current_used >= config.total_storage_limit:
        raise HTTPException(status_code=413, detail="Storage quota exceeded")

    # Setup file metadata and validate provided size
    file_key = str(uuid.uuid4())
    display_name = filename or file_key
    content_length = request.headers.get("content-length")

    if (
        content_length
        and config.max_file_size_limit
        and int(content_length) > config.max_file_size_limit
    ):
        raise HTTPException(status_code=413, detail="File too large")

    # Track bytes and stream directly to S3 using multipart if needed
    total_bytes = 0
    MIN_PART_SIZE = 5 * 1024 * 1024  # S3 multipart minimum

    upload_id = None
    parts: list[dict[str, Any]] = []
    part_number = 1
    buffer = bytearray()

    try:
        async for chunk in request.stream():
            total_bytes += len(chunk)
            buffer.extend(chunk)

            # Enforce runtime quota in case Content-Length was spoofed/missing
            if config.max_file_size_limit and total_bytes > config.max_file_size_limit:
                raise HTTPException(
                    status_code=413, detail="Limit exceeded during upload"
                )

            # Start multipart once we reach the minimum part size
            if upload_id is None and len(buffer) >= MIN_PART_SIZE:
                resp = await s3.create_multipart_upload(
                    Bucket=settings.RUSTFS_BUCKET_NAME,
                    Key=file_key,
                    ContentType=request.headers.get(
                        "content-type", "application/octet-stream"
                    ),
                )
                upload_id = resp["UploadId"]

                resp2 = await s3.upload_part(
                    Bucket=settings.RUSTFS_BUCKET_NAME,
                    Key=file_key,
                    PartNumber=part_number,
                    UploadId=upload_id,
                    Body=bytes(buffer),
                )
                parts.append({"ETag": resp2["ETag"], "PartNumber": part_number})
                part_number += 1
                buffer.clear()

        # Finalize upload
        if upload_id is None:
            # Small file -> single put
            put_kwargs = {
                "Bucket": settings.RUSTFS_BUCKET_NAME,
                "Key": file_key,
                "Body": bytes(buffer),
                "ContentType": request.headers.get(
                    "content-type", "application/octet-stream"
                ),
            }
            if content_length:
                put_kwargs["ContentLength"] = int(content_length)
            await s3.put_object(**put_kwargs)
        else:
            # Upload any remaining bytes as the final part
            if buffer:
                resp = await s3.upload_part(
                    Bucket=settings.RUSTFS_BUCKET_NAME,
                    Key=file_key,
                    PartNumber=part_number,
                    UploadId=upload_id,
                    Body=bytes(buffer),
                )
                parts.append({"ETag": resp["ETag"], "PartNumber": part_number})

            await s3.complete_multipart_upload(
                Bucket=settings.RUSTFS_BUCKET_NAME,
                Key=file_key,
                UploadId=upload_id,
                MultipartUpload=cast(Any, {"Parts": parts}),
            )

    except Exception:
        logger.exception("Streaming upload failed for %s", file_key)
        # If multipart started, abort it
        if upload_id:
            try:
                await s3.abort_multipart_upload(
                    Bucket=settings.RUSTFS_BUCKET_NAME,
                    Key=file_key,
                    UploadId=upload_id,
                )
            except Exception:
                logger.exception("Failed to abort multipart upload for %s", file_key)
        raise HTTPException(status_code=500, detail="Internal transfer error")

    # Persist file record using the recorded size (fallback to actual transferred bytes)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    size = int(content_length) if content_length else total_bytes

    file_obj = File(
        filename=display_name,
        size=size,
        expires_at=now + timedelta(seconds=expire_after),
        expire_after_n_download=expire_after_n_download,
        created_at=now,
        key=file_key,
    )
    session.add(file_obj)
    await session.commit()
    await session.refresh(file_obj)

    # Schedule cleanup task
    background.add_task(
        lambda: delete_expired_file.apply_async(
            (str(file_obj.id),), eta=file_obj.expires_at
        )
    )

    return FileOut(key=file_key)
