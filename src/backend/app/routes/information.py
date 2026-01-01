from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app.deps import S3Dep, SessionDep
from app.models.files import File, FileInformationOut
from app.settings import settings

router = APIRouter()


@router.get("/information/{key}", response_model=FileInformationOut)
async def get_file_information(
    key: str,
    session: SessionDep,
    s3: S3Dep,
):
    query = select(File).where(File.key == key)
    result = await session.exec(query)
    file_record = result.one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    if file_record.is_expired:
        raise HTTPException(status_code=410, detail="File is expired")

    try:
        s3_response = await s3.head_object(
            Bucket=settings.RUSTFS_BUCKET_NAME,
            Key=key,
        )
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code == "404" or error_code == "NoSuchKey":
            raise HTTPException(status_code=404, detail="File not found in storage")
        raise e

    return {
        "filename": file_record.filename,
        "size": s3_response.get("ContentLength"),
    }
