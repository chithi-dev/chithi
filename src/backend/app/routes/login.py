from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import select, or_

from app import security
from app.deps import SessionDep
from app.schemas.token import Token
from app.settings import settings
from app.models import User

router = APIRouter()


@router.post("")
async def login_access_token(
    session: SessionDep, form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    # 1. Look up user
    statement = select(User).where(
        or_(User.username == form_data.username, User.email == form_data.username)
    )
    result = await session.exec(statement)
    user = result.first()

    # 2. Validate user and password
    print(user)
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )

    # 3. Check status
    # if not user.is_active:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
    #     )

    # 4. Generate Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    token_string = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )

    return Token(access_token=token_string, token_type="bearer")
