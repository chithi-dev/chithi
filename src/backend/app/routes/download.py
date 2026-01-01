from botocore.exceptions import ClientError
import os
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import select

from app.deps import S3Dep, SessionDep
from app.models.files import File
from app.settings import settings
from app.tasks.clean_file import delete_expired_file

router = APIRouter()


@router.get("/download/{key}")
async def download_files(
    key: str,
    session: SessionDep,
    s3: S3Dep,
    background_tasks: BackgroundTasks,
    range_header: str | None = Header(default=None, alias="Range"),
):
    if not range_header:
        raise HTTPException(status_code=400, detail="Range header is required")

    query = select(File).where(File.key == key)
    result = await session.exec(query)
    file_record = result.one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    if file_record.is_expired:
        raise HTTPException(status_code=410, detail="File is expired")

    file_record.download_count += 1
    session.add(file_record)
    await session.commit()

    if file_record.download_count >= file_record.expire_after_n_download:
        background_tasks.add_task(delete_expired_file.delay, str(file_record.id))

    try:
        s3_response = await s3.get_object(
            Bucket=settings.RUSTFS_BUCKET_NAME, Key=key, Range=range_header
        )
    except ClientError as e:
        # Check if it is a 404
        error_code = e.response.get("Error", {}).get("Code")
        if error_code == "NoSuchKey":
            raise HTTPException(status_code=404, detail="File not found in storage")
        elif error_code == "InvalidRange":
            # Generate gibberish data
            content_length = 1024 * 1024  # 1MB default

            # Try to parse range header to match requested length
            try:
                if range_header.startswith("bytes="):
                    ranges = range_header[6:].split("-")
                    if len(ranges) >= 1 and ranges[0]:
                        start = int(ranges[0])
                        if len(ranges) >= 2 and ranges[1]:
                            end = int(ranges[1])
                            content_length = end - start + 1
            except ValueError:
                pass

            async def gibberish_generator():
                chunk_size = 64 * 1024
                remaining = content_length
                while remaining > 0:
                    size = min(chunk_size, remaining)
                    yield os.urandom(size)
                    remaining -= size

            return StreamingResponse(
                gibberish_generator(),
                status_code=206,
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": f'attachment; filename="{file_record.filename}"',
                    "Content-Length": str(content_length),
                    "Accept-Ranges": "bytes",
                },
            )
        raise e

    async def stream_generator():
        async for chunk in s3_response["Body"]:
            yield chunk

    return StreamingResponse(
        stream_generator(),
        status_code=206,
        media_type=s3_response.get("ContentType", "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{file_record.filename}"',
            "Content-Range": s3_response.get("ContentRange", ""),
            "Content-Length": str(s3_response.get("ContentLength", "")),
            "Accept-Ranges": "bytes",
        },
    )
