from botocore.exceptions import ClientError
from fastapi import APIRouter, BackgroundTasks, HTTPException
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
):
    # Fetch file metadata
    query = select(File).where(File.key == key)
    result = await session.exec(query)
    file_record = result.one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    if file_record.is_expired:
        raise HTTPException(status_code=410, detail="File is expired")

    try:
        # Get entire file from S3
        s3_response = await s3.get_object(Bucket=settings.RUSTFS_BUCKET_NAME, Key=key)
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code == "NoSuchKey":
            raise HTTPException(status_code=404, detail="File not found in storage")
        raise HTTPException(status_code=500, detail="Storage error")

    # Increment download count immediately
    file_record.download_count += 1
    session.add(file_record)
    await session.commit()

    # Schedule deletion if limit reached (after response is sent)
    if file_record.download_count >= file_record.expire_after_n_download:
        background_tasks.add_task(delete_expired_file.delay, str(file_record.id))

    async def stream_file():
        try:
            async for chunk in s3_response["Body"]:
                yield chunk
        finally:
            s3_response["Body"].close()

    return StreamingResponse(
        stream_file(),
        status_code=200,
        media_type=s3_response.get("ContentType", "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{file_record.filename}"',
        },
    )
