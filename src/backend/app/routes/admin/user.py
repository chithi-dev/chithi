from fastapi import APIRouter

from app.deps import CurrentUser, SessionDep
from app.models.user import UserOut, UserUpdate

router = APIRouter()


@router.patch("/user", response_model=UserOut)
async def change_user(
    session: SessionDep,
    user_in: UserUpdate,
    user: CurrentUser,
):
    update_dict = user_in.model_dump(exclude_unset=True)
    user.sqlmodel_update(update_dict)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
