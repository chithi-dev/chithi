from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlmodel import func, select

from app.deps import CurrentUser, SessionDep
from app.models.files import (
    File,
    FileOut,
    PaginatedFileInformationOut,
)
from app.tasks import delete_expired_file

router = APIRouter()


@router.get("/files", response_model=PaginatedFileInformationOut)
async def show_all_files(
    _: CurrentUser,  # Only check for login here
    session: SessionDep,
    cursor: UUID | None = None,
    limit: int = 100,
):
    now = datetime.now(timezone.utc)
    soon = now + timedelta(days=1)

    # Total count
    count_query = select(func.count()).select_from(File)
    total = (await session.exec(count_query)).one()

    # Total bytes
    sum_bytes_query = select(func.coalesce(func.sum(File.size), 0)).select_from(File)
    total_bytes = (await session.exec(sum_bytes_query)).one()

    # Active URLs
    active_urls_query = (
        select(func.count())
        .select_from(File)
        .where(
            (File.expires_at >= now)
            & (File.download_count < File.expire_after_n_download)
        )
    )
    active_urls = (await session.exec(active_urls_query)).one()

    # Expiring soon (within 24h and not already expired)
    expiring_soon_query = (
        select(func.count())
        .select_from(File)
        .where(
            (File.expires_at >= now)
            & (File.expires_at <= soon)
            & (File.download_count < File.expire_after_n_download)
        )
    )
    expiring_soon = (await session.exec(expiring_soon_query)).one()

    # Links with download caps
    # Assuming any file has a download cap as it's not nullable in DB
    links_with_download_caps_query = select(func.count()).select_from(File)
    links_with_download_caps = (
        await session.exec(links_with_download_caps_query)
    ).one()

    # Latest expiry
    latest_expiry_query = select(func.max(File.expires_at)).where(
        (File.expires_at >= now) & (File.download_count < File.expire_after_n_download)
    )
    latest_expiry = (await session.exec(latest_expiry_query)).one()

    # Paginated items
    query = select(File).order_by(File.id.desc()).limit(limit)  # type: ignore
    if cursor:
        query = query.where(File.id < cursor)

    result = await session.exec(query)
    file_objects = result.all()

    next_cursor = file_objects[-1].id if len(file_objects) == limit else None

    return PaginatedFileInformationOut(
        items=file_objects,
        total=total,
        next_cursor=next_cursor,
        limit=limit,
        total_bytes=total_bytes,
        active_urls=active_urls,
        links_with_download_caps=links_with_download_caps,
        expiring_soon=expiring_soon,
        latest_expiry=latest_expiry,
        has_indefinite_active_urls=False,
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
