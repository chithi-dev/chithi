from fastapi import APIRouter
from app.deps import SessionDep, CurrentUser
from app.models.user import UserIn, UserOut

router = APIRouter()


@router.patch("/user", response_model=UserOut)
async def change_user(
    session: SessionDep,
    user_in: UserIn,
    user: CurrentUser,
):
    update_dict = user_in.model_dump(exclude_unset=True)
    user.sqlmodel_update(update_dict)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
