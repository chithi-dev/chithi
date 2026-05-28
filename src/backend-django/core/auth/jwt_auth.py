"""JWT authentication for Strawberry Django resolvers."""

from __future__ import annotations

import datetime
from uuid import UUID, uuid4

import jwt
from django.conf import settings as dj_settings  # noqa: F401
from strawberry.types.info import Info


def _secret_key() -> bytes:
    return dj_settings.SECRET_KEY.encode("utf-8")  # type: ignore[attr-defined,union-attr]


_ACCESS_TOKEN_EXPIRE_MINUTES = getattr(
    dj_settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 11520
)


def create_access_token(user_id: UUID) -> str:
    """Create a signed JWT access token for *user_id*."""
    expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"exp": expire, "sub": str(user_id)}
    return jwt.encode(payload, _secret_key(), algorithm="HS256")


def decode_access_token(token: str) -> UUID | None:
    """Decode and validate a JWT; returns user_id (UUID) or None."""
    try:
        payload = jwt.decode(token, _secret_key(), algorithms=["HS256"])
        return UUID(payload["sub"])  # type: ignore[arg-type]
    except (jwt.PyJWTError, ValueError, KeyError):
        return None


async def get_current_user(info: Info) -> "User | None":  # noqa: F821 - forward ref
    """Resolve current authenticated user from JWT cookie in request.

    Reads 'access_token' cookie from info.context.request.COOKIES.
    Returns a User instance or None if not authenticated.
    """
    request = info.context.request  # type: ignore[attr-defined]
    token = request.COOKIES.get("access_token")  # type: ignore[union-attr]

    if not token:
        return None

    user_id = decode_access_token(token)
    if not user_id:
        return None

    from apps.users.models import User as UserModel

    try:
        return await UserModel.objects.aget(id=user_id)  # type: ignore[arg-type]
    except Exception:
        return None


async def require_auth(info: Info) -> "User":  # noqa: F821 - forward ref
    """Resolver helper that returns current user or raises PermissionError."""
    user = await get_current_user(info)
    if user is None:
        raise PermissionError("Authentication required")
    return user  # type: ignore[return-value]


def set_auth_cookie(response, token: str) -> None:  # type: ignore[name-defined]
    """Set JWT access_token cookie on the Strawberry response object.

    Called from login/onboard mutations via info.context.response.set_cookie().
    """
    response.set_cookie(  # type: ignore[attr-defined]
        key="access_token",
        value=token,
        httponly=True,
        samesite="Lax",
        secure=dj_settings.DEBUG is False,  # type: ignore[attr-defined,union-attr]
        max_age=_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/graphql",
    )


def clear_auth_cookie(response) -> None:  # type: ignore[name-defined]
    """Clear the JWT access_token cookie from the response."""
    response.delete_cookie("access_token", path="/graphql")  # type: ignore[attr-defined]
