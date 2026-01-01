import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Form, UploadFile

from app.converter.bytes import ByteSize
from app.deps import S3Dep, SessionDep
from app.models.files import File, FileOut
from app.settings import settings
from app.tasks.clean_file import delete_expired_file

router = APIRouter()

CHUNK_SIZE = ByteSize(
    mb=8  # 8MB (S3 minimum for multipart)
).total_bytes()


@router.post("/upload")
async def upload_file(
    file: UploadFile,
    filename: Annotated[str | None, Form()],
    expire_after_n_download: Annotated[int, Form()],
    expire_after: Annotated[int, Form()],
    # Dependency Injection
    s3: S3Dep,
    session: SessionDep,
) -> FileOut:
    if not filename:
        filename = uuid.uuid7()  # type: ignore

    key = uuid.uuid7()
    resp = await s3.create_multipart_upload(
        Bucket=settings.RUSTFS_BUCKET_NAME,
        Key=str(key),
        ContentType=file.content_type or "application/octet-stream",
    )
    upload_id = resp["UploadId"]
    parts = []
    part_number = 1

    try:
        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break

            part = await s3.upload_part(
                Bucket=settings.RUSTFS_BUCKET_NAME,
                Key=str(key),
                UploadId=upload_id,
                PartNumber=part_number,
                Body=chunk,
            )

            parts.append({"PartNumber": part_number, "ETag": part["ETag"]})
            part_number += 1

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

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    file_obj = File(
        filename=str(filename),
        expires_at=now + timedelta(seconds=expire_after),
        expire_after_n_download=expire_after_n_download,
        created_at=now,
        key=str(key),
    )
    session.add(file_obj)
    await session.commit()
    await session.refresh(file_obj)

    delete_expired_file.apply_async((str(file_obj.id),), eta=file_obj.expires_at)

    return FileOut(key=str(key))
