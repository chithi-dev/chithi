import contextlib
import json
import platform
from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    Request,
    __version__ as fastapi_version,
)
from sqlalchemy import text
from sqlmodel import func, select

from app.deps import RedisDep, SessionDep
from app.models.files import (
    File,
)
from app.schemas.information import InformationOut, InstanceStatisticsOut

router = APIRouter()


def _get_build_info(base_dir) -> dict:
    """
    Read build info from build-info.json.
    Only in prod, for dev fallback to dev defaults.
    """
    build_info_path = base_dir / "build-info.json"

    # Fallback dev values
    dev_info = {
        "version": "v0.0.0-dev",
        "commit": "dev",
        "is_release": False,
    }

    with contextlib.suppress(json.JSONDecodeError, IOError):
        if build_info_path.exists():
            with open(build_info_path, "r") as f:
                return json.load(f)

    return dev_info


@router.get("/instance/information")
async def get_instance_information(
    request: Request,
    redis: RedisDep,
    session: SessionDep,
):
    # Redis Execution
    info = await redis.info("server")
    redis_version = info["redis_version"]

    # Postgres Execution
    postgres_version = await session.scalar(text("SHOW server_version"))

    # Python Execution
    python_version = platform.python_version()

    # Build Info from app state
    base_dir = request.app.state.base_dir
    build_info = _get_build_info(base_dir)

    return InformationOut(
        python_version=python_version,
        fastapi_version=fastapi_version,
        redis_version=redis_version,
        postgres_version=postgres_version,
        version=build_info["version"],
        commit=build_info["commit"],
        is_release=build_info["is_release"],
    )


@router.get("/instance/statistics")
async def get_instance_statistics(
    session: SessionDep,
    redis: RedisDep,
):
    now = datetime.now(timezone.utc)
    soon = now + timedelta(days=1)

    # Redis Execution
    active_rooms_keys = await redis.keys("chithi:room:*")
    active_rooms = len(active_rooms_keys)

    # Total bytes
    sum_bytes_query = select(func.coalesce(func.sum(File.size), 0)).select_from(File)
    total_bytes = (await session.exec(sum_bytes_query)).one()

    # Total files
    total_files_query = select(func.count()).select_from(File)
    total_files = (await session.exec(total_files_query)).one()

    # Total downloads
    total_downloads_query = select(func.coalesce(func.sum(File.download_count), 0)).select_from(File)
    total_downloads = (await session.exec(total_downloads_query)).one()

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

    meta = {
        "total_bytes": total_bytes,
        "total_files": total_files,
        "total_downloads": total_downloads,
        "active_urls": active_urls,
        "active_rooms": active_rooms,
        "links_with_download_caps": links_with_download_caps,
        "expiring_soon": expiring_soon,
    }
    if latest_expiry:
        meta["latest_expiry"] = int(latest_expiry.timestamp())

    return InstanceStatisticsOut(**meta)
