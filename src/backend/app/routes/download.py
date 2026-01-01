from datetime import datetime, timezone

from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import select

from app.deps import S3Dep, SessionDep
from app.models.files import File
from app.settings import settings

router = APIRouter()


@router.get("/download/{key}")
async def download_files(
    key: str,
    session: SessionDep,
    s3: S3Dep,
):
    # 1. Check DB
    query = select(File).where(File.key == key)
    result = await session.exec(query)
    file_record = result.one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # 2. Check Expiration
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if file_record.expires_at < now:
        raise HTTPException(status_code=410, detail="File expired")

    if file_record.download_count >= file_record.expire_after_n_download:
        raise HTTPException(status_code=410, detail="Download limit reached")

    # 3. Increment count
    file_record.download_count += 1
    session.add(file_record)
    await session.commit()

    # 4. Stream from S3
    try:
        s3_response = await s3.get_object(Bucket=settings.RUSTFS_BUCKET_NAME, Key=key)
    except ClientError as e:
        # Check if it is a 404
        error_code = e.response.get("Error", {}).get("Code")
        if error_code == "NoSuchKey":
            raise HTTPException(status_code=404, detail="File not found in storage")
        raise e

    async def stream_generator():
        async for chunk in s3_response["Body"]:
            yield chunk

    return StreamingResponse(
        stream_generator(),
        media_type=s3_response.get("ContentType", "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{file_record.filename}"'
        },
    )
