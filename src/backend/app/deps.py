from contextlib import asynccontextmanager
from typing import Annotated, AsyncGenerator

import aioboto3
import jwt
import redis.asyncio as redis
from botocore.exceptions import ClientError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from pydantic import ValidationError
from redis.asyncio import Redis
from sqlmodel.ext.asyncio.session import AsyncSession
from types_aiobotocore_s3 import S3Client

from app import security
from app.db import get_session
from app.models import User
from app.schemas.token import TokenPayload
from app.settings import settings

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


@asynccontextmanager
async def get_s3_client() -> AsyncGenerator[S3Client, None]:
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


async def get_redis():
    client = redis.from_url(
        settings.REDIS_ENDPOINT,
        encoding="utf-8",
        decode_responses=True,
    )
    try:
        yield client
    finally:
        await client.aclose()


SessionDep = Annotated[AsyncSession, Depends(get_session)]
TokenDep = Annotated[
    HTTPAuthorizationCredentials,
    Depends(bearer_scheme),
]
CurrentUser = Annotated[User, Depends(get_current_user)]
S3Dep = Annotated[S3Client, Depends(get_s3_client)]
RedisDep = Annotated[Redis, Depends(get_redis)]
__all__ = ["SessionDep", "CurrentUser", "TokenDep", "S3Dep"]
