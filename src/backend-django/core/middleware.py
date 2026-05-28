"""JWT middleware for Strawberry GraphQL ASGI view.

Runs before resolvers so request.user is always set when a resolver calls get_current_user().
"""

from __future__ import annotations

import datetime
from typing import Any, Awaitable, Callable

import jwt
from django.conf import settings as dj_settings  # noqa: F401
from django.contrib.auth.models import AnonymousUser  # type: ignore[import-untyped]


def _secret_key() -> bytes:
    return dj_settings.SECRET_KEY.encode("utf-8")  # type: ignore[attr-defined,union-attr]


class JWTAuthMiddleware:
    """Parse JWT from cookie or Authorization header and attach user to request."""

    def __init__(self, get_response: Callable[[Any], Awaitable[None]]) -> None:
        self.get_response = get_response  # type: ignore[arg-type]

    async def __call__(self, scope: Any, receive: Any, send: Any) -> None:  # noqa: F811
        token = _extract_token(scope)
        user_id = None

        if token:
            try:
                payload = jwt.decode(
                    token, _secret_key(), algorithms=["HS256"]
                )
                from uuid import UUID

                user_id = UUID(payload["sub"])  # type: ignore[literal-required]
            except (jwt.PyJWTError, ValueError, KeyError):
                pass

        scope["user"] = _resolve_user(user_id) if user_id else AnonymousUser()  # type: ignore[index]
        await self.get_response(scope, receive, send)  # type: ignore[misc]


def _extract_token(scope: Any) -> str | None:
    """Extract JWT token from cookie or Authorization header."""
    cookies = scope.get("headers", [])
    if isinstance(cookies, list):
        for name, value in cookies:
            if isinstance(name, bytes) and name == b"cookie":
                cookie_str = value.decode() if isinstance(value, bytes) else str(value)
                for part in cookie_str.split(";"):
                    k, _, v = part.strip().partition("=")
                    if k == "access_token":
                        return v

    auth_header = None
    headers_dict: dict[str, str] = {}
    for name, value in scope.get("headers", []):  # type: ignore[union-attr]
        key = name.decode() if isinstance(name, bytes) else str(name)
        val = value.decode() if isinstance(value, bytes) else str(value)
        headers_dict[key.lower()] = val

    auth_header = headers_dict.get("authorization", "") or scope.get(  # type: ignore[union-attr]
        "headers_dict", {}
    ).get("authorization", "")

    if auth_header.startswith("Bearer "):
        return auth_header[7:]

    return None


def _resolve_user(user_id) -> Any:
    """Resolve Django User from UUID."""
    from apps.users.models import User as UserModel

    try:
        user = UserModel.objects.get(id=user_id)  # type: ignore[arg-type]
        return user
    except (UserModel.DoesNotExist, Exception):
        return AnonymousUser()
