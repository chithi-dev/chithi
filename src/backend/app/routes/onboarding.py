from fastapi import APIRouter, HTTPException, status
from sqlmodel import func, select

from app.deps import SessionDep
from app.models.onboarding import OnboardingOut, OnboardingPOSTOut
from app.models.user import User, UserCreate
from app.security import get_password_hash

router = APIRouter(tags=["onboarding"])


@router.get("/onboarding")
async def get_onboarding_status(session: SessionDep):
    count_statement = select(func.count()).select_from(User)
    exec_result = await session.exec(count_statement)
    count = exec_result.one()
    return OnboardingOut(onboarded=count >= 1)


@router.post("/onboarding", status_code=status.HTTP_201_CREATED)
async def complete_onboarding(user_in: UserCreate, session: SessionDep):
    count_statement = select(func.count()).select_from(User)
    exec_result = await session.exec(count_statement)
    count = exec_result.one()

    if count >= 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Onboarding already completed",
        )

    password_hash = get_password_hash(user_in.password)
    user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=password_hash,
    )
    session.add(user)
    await session.commit()

    return OnboardingPOSTOut(message="Onboarding completed successfully")
