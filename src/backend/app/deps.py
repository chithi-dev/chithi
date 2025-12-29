from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Annotated
from app.db import get_session
from fastapi import Depends, HTTPException, status
import jwt
from jwt import InvalidTokenError
from pydantic import ValidationError
from app.models import User
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.schemas.token import TokenPayload
from app.settings import settings
from app import security

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(session: SessionDep, token: TokenDep) -> User:
    try:
        payload = jwt.decode(
            token.credentials, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = await session.get(User, token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


SessionDep = Annotated[AsyncSession, Depends(get_session)]
TokenDep = Annotated[
    HTTPAuthorizationCredentials,
    Depends(bearer_scheme),
]
CurrentUser = Annotated[User, Depends(get_current_user)]

__all__ = ["SessionDep", "CurrentUser", "TokenDep"]
