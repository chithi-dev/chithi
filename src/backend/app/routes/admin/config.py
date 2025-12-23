from fastapi import APIRouter, HTTPException
from app.deps import SessionDep, CurrentUser
from app.models.config import Config
from sqlmodel import select
from app.schemas.config import ConfigIn
from http import HTTPStatus

router = APIRouter()


@router.patch("/config", response_model=Config)
async def change_config(
    _: CurrentUser,  # Only check for login here
    session: SessionDep,
    config_in: ConfigIn,
):
    config_object = select(Config)
    result = await session.exec(config_object)
    config = result.first()
    if not config:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Config not found")

    update_dict = config_in.model_dump(exclude_unset=True)
    config.sqlmodel_update(update_dict)
    session.add(config)
    await session.commit()
    await session.refresh(config)
    return config
