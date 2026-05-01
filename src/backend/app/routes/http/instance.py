import contextlib
import json
import platform

from fastapi import (
    APIRouter,
    __version__ as fastapi_version,
    Request,
)
from sqlalchemy import text

from app.deps import RedisDep, SessionDep
from app.models.information import InformationOut

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
