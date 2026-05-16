from http import HTTPStatus

from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlmodel import col, select

from app.deps import CurrentUser, PaginationDep, SessionDep
from app.models.files import (
    File,
    FileInformationOut,
    FileOut,
)
from app.pagination import Page, paginate
from app.tasks import delete_expired_file

router = APIRouter()


@router.get("/files", response_model=Page[FileInformationOut])
async def show_all_files(
    _: CurrentUser,  # Only check for login here
    session: SessionDep,
    pagination: PaginationDep,
):
    return await paginate(
        select(File).order_by(col(File.id).desc()), session, pagination
    )


@router.delete("/files/{id}")
async def delete_file(
    _: CurrentUser,
    id: str,
    session: SessionDep,
    background_tasks: BackgroundTasks,
):
    query = select(File).where(File.id == id)
    result = await session.exec(query)
    file_object = result.one_or_none()

    if not file_object:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="File not found")

    background_tasks.add_task(delete_expired_file.delay, id)

    return FileOut(key=file_object.key)
