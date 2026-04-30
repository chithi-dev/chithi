import platform

from fastapi import (
    APIRouter,
    __version__ as fastapi_version,
)
from sqlalchemy import text

from app.deps import RedisDep, SessionDep
from app.models.information import InformationOut

router = APIRouter()


@router.get("/instance/information")
async def get_instance_information(
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
    return InformationOut(
        python_version=python_version,
        fastapi_version=fastapi_version,
        redis_version=redis_version,
        postgres_version=postgres_version,
    )
