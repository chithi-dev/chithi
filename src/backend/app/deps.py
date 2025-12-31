from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Annotated, Any
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
import aioboto3
from botocore.exceptions import ClientError
from botocore.client import BaseClient

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


async def get_s3_client():
    session = aioboto3.Session()
    async with session.client(
        "s3",
        endpoint_url=settings.RUSTFS_ENDPOINT_URL,  # RustFS S3 API
        aws_access_key_id=settings.RUSTFS_ACCESS_KEY,
        aws_secret_access_key=settings.RUSTFS_SECRET_ACCESS_KEY,
    ) as s3_client:
        # Ensure bucket exists
        try:
            await s3_client.head_bucket(Bucket=settings.RUSTFS_BUCKET_NAME)
        except ClientError:
            await s3_client.create_bucket(Bucket=settings.RUSTFS_BUCKET_NAME)
        yield s3_client


SessionDep = Annotated[AsyncSession, Depends(get_session)]
TokenDep = Annotated[
    HTTPAuthorizationCredentials,
    Depends(bearer_scheme),
]
CurrentUser = Annotated[User, Depends(get_current_user)]
S3Dep = Annotated[BaseClient, Depends(get_s3_client)]

__all__ = ["SessionDep", "CurrentUser", "TokenDep", "S3Dep"]
