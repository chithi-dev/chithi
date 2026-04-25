from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app.deps import CurrentUser, PaginationDep, SessionDep
from app.models.user import User, UserCreate, UserOut, UserUpdate
from app.pagination import Page, paginate
from app.security import get_password_hash

router = APIRouter()


@router.get("/users", response_model=Page[UserOut])
async def get_users(
    session: SessionDep,
    _: CurrentUser,
    pagination: PaginationDep,
):
    return await paginate(select(User), session, pagination)


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


@router.post("/user", response_model=UserOut)
async def create_user(
    session: SessionDep,
    user_in: UserCreate,
    _: CurrentUser,
):
    user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@router.delete("/user/{user_id}", response_model=UserOut)
async def delete_user(
    session: SessionDep,
    user_id: UUID,
    _: CurrentUser,
):
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await session.delete(user)
    await session.commit()
    return user
