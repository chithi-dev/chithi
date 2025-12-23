from http import HTTPStatus
from fastapi import APIRouter, HTTPException
from app.deps import SessionDep
from sqlmodel import select
from app.models.config import Config

router = APIRouter()


@router.get("/config")
async def get_config(session: SessionDep):
    config_object = select(Config)
    result = await session.exec(config_object)
    config_object = result.first()
    if not config_object:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Config not found")
    return config_object
