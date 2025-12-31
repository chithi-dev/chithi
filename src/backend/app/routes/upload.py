from typing import Annotated
from http import HTTPStatus

from fastapi import APIRouter, HTTPException, UploadFile, Form
from sqlmodel import select

from app.deps import S3Dep
from app.models import User
from app.models.user import UserOut

router = APIRouter()


@router.get("/upload")
async def get_current_user(
    file: UploadFile,
    expire_after_n_download: Annotated[int, Form()],
    expire_after: Annotated[int, Form()],
    s3: S3Dep,
):
    pass
