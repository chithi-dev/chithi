import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from botocore.exceptions import ClientError
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from sqlmodel import select

from app.converter.bytes import ByteSize
from app.deps import S3Dep, SessionDep
from app.models.config import Config
from app.models.files import File, FileOut
from app.settings import settings
from app.tasks.clean_file import delete_expired_file
from app.tasks.multipart_cleanup import abort_multipart_upload_task

logger = logging.getLogger(__name__)

router = APIRouter()

CHUNK_SIZE = ByteSize(gb=1).total_bytes()

# Dynamic chunk sizing constants
MIN_PART_SIZE = ByteSize(mb=512).total_bytes()
MAX_PART_SIZE = ByteSize(
    mb=256
).total_bytes()  # cap part size so memory usage doesn't explode
MAX_PARTS = 10000  # S3 multipart upload parts limit

# How many times to retry a failing part upload before giving up
MAX_PART_RETRIES = 4


def compute_chunk_size(file_size: int | None) -> int:
    """Pick a part size based on total file size.

    - If file_size is unknown, return the default MIN_PART_SIZE.
    - Otherwise, pick ceil(file_size / MAX_PARTS), clamped to [MIN_PART_SIZE, MAX_PART_SIZE]
      and rounded up to the nearest MB for nicer alignment.
    """
    if not file_size or file_size <= 0:
        return MIN_PART_SIZE

    # Required per-part size to keep number of parts <= MAX_PARTS
    required = (file_size + MAX_PARTS - 1) // MAX_PARTS

    # Clamp into allowed range
    chosen = max(MIN_PART_SIZE, min(required, MAX_PART_SIZE))

    # Round up to nearest MB for better network behaviour
    mb = 1024 * 1024
    if chosen % mb:
        chosen = ((chosen + mb - 1) // mb) * mb
    return chosen


async def _upload_part_with_retries(
    s3,
    bucket: str,
    key: str,
    upload_id: str,
    part_number: int,
    chunk: bytes,
    max_retries: int = MAX_PART_RETRIES,
) -> dict[str, str]:
    """Attempt to upload a single part with exponential backoff retries.

    Always return a non-empty mapping containing at least 'ETag' on success.
    If the underlying client returns an unexpected value (None or missing
    ETag) we raise so the caller can handle cleanup.
    """
    delay = 1
    for attempt in range(1, max_retries + 1):
        try:
            resp = await s3.upload_part(
                Bucket=bucket,
                Key=key,
                UploadId=upload_id,
                PartNumber=part_number,
                Body=chunk,
            )
            if not resp or "ETag" not in resp:
                # Treat missing or empty response as an error to trigger retries/cleanup
                raise RuntimeError("`upload_part` returned empty or malformed response")
            return resp  # type: ignore[return-value]
        except ClientError as e:
            logger.warning(
                "upload_part failed attempt %s/%s for %s (part %s): %s",
                attempt,
                max_retries,
                key,
                part_number,
                e,
            )
            if attempt == max_retries:
                raise
            await asyncio.sleep(delay)
            delay *= 2
        except Exception:
            logger.exception(
                "Unexpected error uploading part %s for %s on attempt %s/%s",
                part_number,
                key,
                attempt,
                max_retries,
            )
            if attempt == max_retries:
                raise
            await asyncio.sleep(delay)
            delay *= 2

    # Should not reach here because the loop raises on the final failed attempt,
    # but add an explicit error to satisfy static type checkers and provide
    # a clear message for downstream handling.
    raise RuntimeError(
        f"Failed to upload part {part_number} for {key} after {max_retries} attempts"
    )


async def _get_current_storage_used(session: SessionDep, s3: S3Dep) -> int:
    """Sum the sizes (ContentLength) of currently active (non-expired) files."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
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
    request: Request,
    s3: S3Dep,
    session: SessionDep,
    background: BackgroundTasks,
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
        #  no space at all left
        if current_used >= total_limit:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Storage quota exceeded",
            )

    # Determine file size (prefer Content-Length header, fall back to probing UploadFile)
    file_size: int | None = None
    cl = request.headers.get("content-length")
    if cl:
        try:
            file_size = int(cl)
        except Exception:
            logger.debug("Invalid Content-Length header: %r", cl)
    if not file_size:
        try:
            fobj = file.file
            # Save position, seek to end to get size, then restore
            pos = fobj.tell()
            fobj.seek(0, 2)
            file_size = fobj.tell()
            fobj.seek(pos)
        except Exception:
            # Could not determine size; leave as None
            file_size = None

    chunk_size = compute_chunk_size(file_size)
    logger.info(
        "upload_chunk_size_selected",
        extra={"file_size": file_size, "chunk_size": chunk_size},
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
            chunk = await file.read(chunk_size)
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
                # This will be handled by the abort/cleanup logic below
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Storage quota exceeded",
                )

            try:
                part = await _upload_part_with_retries(
                    s3,
                    settings.RUSTFS_BUCKET_NAME,
                    str(key),
                    upload_id,
                    part_number,
                    chunk,
                )
            except Exception as exc:
                logger.exception(
                    "Part upload failed irrecoverably for %s (part %s)",
                    key,
                    part_number,
                )
                # Try to abort now; if abort fails, schedule a celery retry task
                try:
                    await s3.abort_multipart_upload(
                        Bucket=settings.RUSTFS_BUCKET_NAME,
                        Key=str(key),
                        UploadId=upload_id,
                    )
                except Exception:
                    logger.exception(
                        "Immediate abort failed for %s %s; scheduling async abort task",
                        key,
                        upload_id,
                    )
                    abort_multipart_upload_task.apply_async(
                        (settings.RUSTFS_BUCKET_NAME, str(key), upload_id)
                    )
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Upload failed; cleanup scheduled",
                ) from exc

            # Ensure the upload_part response is valid before subscripting it
            if not part or "ETag" not in part:
                logger.exception(
                    "upload_part returned invalid response for %s (part %s): %r",
                    key,
                    part_number,
                    part,
                )
                # Attempt immediate abort, otherwise schedule background cleanup
                try:
                    await s3.abort_multipart_upload(
                        Bucket=settings.RUSTFS_BUCKET_NAME,
                        Key=str(key),
                        UploadId=upload_id,
                    )
                except Exception:
                    logger.exception(
                        "Immediate abort failed for %s %s; scheduling async abort task",
                        key,
                        upload_id,
                    )
                    abort_multipart_upload_task.apply_async(
                        (settings.RUSTFS_BUCKET_NAME, str(key), upload_id)
                    )
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Upload failed; cleanup scheduled",
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

    except Exception as exc:
        logger.exception("Upload failed for %s, attempting abort: %s", key, exc)
        try:
            await s3.abort_multipart_upload(
                Bucket=settings.RUSTFS_BUCKET_NAME,
                Key=str(key),
                UploadId=upload_id,
            )
        except Exception:
            logger.exception(
                "Immediate abort failed for %s %s; scheduling async abort task",
                key,
                upload_id,
            )
            abort_multipart_upload_task.apply_async(
                (settings.RUSTFS_BUCKET_NAME, str(key), upload_id)
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Upload failed; cleanup scheduled",
        ) from exc
    now = datetime.now(timezone.utc).replace(tzinfo=None)
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

    background.add_task(
        lambda: delete_expired_file.apply_async(
            (str(file_obj.id),), eta=file_obj.expires_at
        )
    )

    return FileOut(key=str(key))
