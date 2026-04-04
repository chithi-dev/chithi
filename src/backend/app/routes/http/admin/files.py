from http import HTTPStatus

from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlmodel import case, col, func, select

from app.deps import CurrentUser, SessionDep
from app.models.files import File, FileOut, FilesWithStats
from app.tasks import delete_expired_file

router = APIRouter()


@router.get("/files")
async def show_all_files(
    _: CurrentUser,
    session: SessionDep,
) -> FilesWithStats:
    rows = (await session.exec(
        select(
            File,
            func.count().over().label("total_urls"),
            func.sum(col(File.size)).over().label("total_size"),
            func.sum(
                case((col(File.expire_after_n_download) > 0, 1), else_=0)
            ).over().label("links_with_download_caps"),
            func.max(col(File.expires_at)).over().label("max_expires_at"),
            func.row_number().over(order_by=col(File.expires_at).desc()).label("expiry_rank"),
        ).order_by(col(File.id))  # type: ignore[arg-type]
    )).all()

    if not rows:
        return FilesWithStats(files=[], total_urls=0, total_size=0, links_with_download_caps=0, max_expires_at=None, longest_expiry_file=None,)

    first = rows[0]

    return FilesWithStats(
        files=[row[0] for row in rows],
        total_urls=first[1],
        total_size=first[2] or 0,
        links_with_download_caps=first[3],
        max_expires_at=first[4],
        longest_expiry_file=next(row[0] for row in rows if row[5] == 1),
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

    background_tasks.add_task(delete_expired_file.delay, str(id))

    return FileOut(key=file_object.key)
