from http import HTTPStatus

from fastapi import APIRouter, HTTPException, BackgroundTasks
from sqlmodel import select

from app.deps import CurrentUser, SessionDep
from app.models.files import File, FileInformationOut, FileOut
from app.tasks import delete_expired_file

router = APIRouter()


@router.get("/files", response_model=list[FileInformationOut])
async def show_all_files(
    _: CurrentUser,  # Only check for login here
    session: SessionDep,
):
    query = select(File)
    result = await session.exec(query)
    file_objects = result.all()
    return file_objects


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
    if file_object.is_expired:
        raise HTTPException(status_code=HTTPStatus.GONE, detail="File is expired")

    background_tasks.add_task(delete_expired_file, str(id))

    return FileOut(key=file_object.key)
