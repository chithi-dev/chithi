from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import or_, select

from app import security
from app.decorators.rate_limit import rate_limit
from app.deps import SessionDep
from app.models import User
from app.schemas.token import Token
from app.settings import settings

router = APIRouter()


@router.post("/login")
@rate_limit("3req/sec", "60req/min")
async def login_endpoint(
    session: SessionDep, form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    # Look up user
    statement = select(User).where(
        or_(User.username == form_data.username, User.email == form_data.username)
    )
    result = await session.exec(statement)
    user = result.first()

    # Validate user and password
    print(user)
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )

    # Check status
    # if not user.is_active:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user"
    #     )

    # Generate Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    token_string = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )

    return Token(access_token=token_string, token_type="bearer")
