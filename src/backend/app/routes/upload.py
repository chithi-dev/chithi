import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, UploadFile, status
from sqlmodel import select

from app.converter.bytes import ByteSize
from app.deps import S3Dep, SessionDep
from app.models.config import Config
from app.models.files import File, FileOut
from app.settings import settings
from app.tasks.clean_file import delete_expired_file

router = APIRouter()

CHUNK_SIZE = ByteSize(
    mb=8  # 8MB (S3 minimum for multipart)
).total_bytes()


async def _get_current_storage_used(session: SessionDep, s3: S3Dep) -> int:
    """Sum the sizes (ContentLength) of currently active (non-expired) files."""
    now = datetime.now(timezone.utc)
    query = select(File).where(
        File.expires_at > now, File.download_count < File.expire_after_n_download
    )
    result = await session.exec(query)
    files = result.all()

    total = 0
    for f in files:
        try:
            resp = await s3.head_object(Bucket=settings.RUSTFS_BUCKET_NAME, Key=f.key)
            total += int(resp.get("ContentLength", 0) or 0)
        except Exception:
            # If the object is missing or head fails for any reason, ignore and continue
            continue
    return total


@router.post("/upload")
async def upload_file(
    file: UploadFile,
    filename: Annotated[str | None, Form()],
    expire_after_n_download: Annotated[int, Form()],
    expire_after: Annotated[int, Form()],
    # Dependency Injection
    s3: S3Dep,
    session: SessionDep,
    background_tasks: BackgroundTasks,
) -> FileOut:
    if not filename:
        filename = uuid.uuid7()  # type: ignore

    key = uuid.uuid7()

    # Load the singleton config and determine current usage
    config_q = select(Config)
    config_result = await session.exec(config_q)
    config = config_result.first()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configuration not found",
        )

    total_limit = config.total_storage_limit
    max_file_size_limit = config.max_file_size_limit
    current_used = 0
    if total_limit is not None:
        current_used = await _get_current_storage_used(session, s3)
        # Quick fail: no space at all left
        if current_used >= total_limit:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Storage quota exceeded",
            )

    resp = await s3.create_multipart_upload(
        Bucket=settings.RUSTFS_BUCKET_NAME,
        Key=str(key),
        ContentType=file.content_type or "application/octet-stream",
    )
    upload_id = resp["UploadId"]
    parts = []
    part_number = 1
    uploaded_size = 0

    try:
        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break

            # Enforce max file size limit
            if (
                max_file_size_limit is not None
                and uploaded_size + len(chunk) > max_file_size_limit
            ):
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="File size exceeds the maximum allowed limit",
                )

            # Enforce total storage limit incrementally
            if (
                total_limit is not None
                and current_used + uploaded_size + len(chunk) > total_limit
            ):
                # This will be caught by the outer except block which aborts the multipart upload
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Storage quota exceeded",
                )

            part = await s3.upload_part(
                Bucket=settings.RUSTFS_BUCKET_NAME,
                Key=str(key),
                UploadId=upload_id,
                PartNumber=part_number,
                Body=chunk,
            )

            parts.append({"PartNumber": part_number, "ETag": part["ETag"]})
            part_number += 1
            uploaded_size += len(chunk)

        await s3.complete_multipart_upload(
            Bucket=settings.RUSTFS_BUCKET_NAME,
            Key=str(key),
            UploadId=upload_id,
            MultipartUpload={"Parts": parts},
        )

    except Exception:
        await s3.abort_multipart_upload(
            Bucket=settings.RUSTFS_BUCKET_NAME,
            Key=str(key),
            UploadId=upload_id,
        )
        raise
    now = datetime.now(timezone.utc)
    file_obj = File(
        filename=str(filename),
        size=uploaded_size,
        expires_at=now + timedelta(seconds=expire_after),
        expire_after_n_download=expire_after_n_download,
        created_at=now,
        key=str(key),
    )
    session.add(file_obj)
    await session.commit()
    await session.refresh(file_obj)

    background_tasks.add_task(
        lambda: delete_expired_file.apply_async(
            (str(file_obj.id),), eta=file_obj.expires_at
        )
    )
    return FileOut(key=str(key))
