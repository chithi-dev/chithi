from http import HTTPStatus

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app.deps import CurrentUser, SessionDep
from app.models import User
from app.models.user import UserOut

router = APIRouter()


@router.get("/user", response_model=UserOut)
async def get_current_user(
    user: CurrentUser,
    session: SessionDep,
):
    user_object = select(User).where(User.id == user.id)
    result = await session.exec(user_object)
    item = result.first()
    if not item:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="User not found")

    return item
