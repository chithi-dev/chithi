from __future__ import annotations

import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

import jwt
from django.conf import settings as dj_settings  # noqa: F401
from strawberry.types.info import Info

if TYPE_CHECKING:
    from apps.users.models import User


def _secret_key() -> bytes:
    return dj_settings.SECRET_KEY.encode("utf-8")  # type: ignore[attr-defined,union-attr]


_ACCESS_TOKEN_EXPIRE_MINUTES = getattr(
    dj_settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 11520
)


class _ASGIMETA:
    """Thin dict-like wrapper exposing HTTP headers as ``HTTP_`` META keys."""

    def __init__(self, scope_headers: list[tuple[bytes, bytes]]) -> None:
        self._data: dict[str, str] = {}
        for key_bytes, value_bytes in scope_headers:
            key = key_bytes.decode("utf-8").lower().replace("-", "_")
            self._data[f"HTTP_{key.upper()}"] = value_bytes.decode("utf-8")

    def get(self, key: str, default: str | None = None) -> str | None:
        return self._data.get(key, default)  # type: ignore[type-arg]

    def __getitem__(self, key: str) -> str | None:
        return self._data[key]


class _ASGIRequest:
    """Django HttpRequest-like wrapper around ASGI scope + receive."""

    def __init__(self, scope_headers: list[tuple[bytes, bytes]]) -> None:
        self.META = _ASGIMETA(scope_headers)
        # Parse cookies from Cookie header (same parsing Django does).
        raw_cookie = self.META.get("HTTP_COOKIE", "")
        self.COOKIES: dict[str, str] = {}
        if raw_cookie:
            for part in raw_cookie.split(";"):
                part = part.strip()
                if "=" in part:
                    k, v = part.split("=", 1)
                    try:
                        self.COOKIES[k.strip()] = v.strip()
                    except ValueError:
                        pass


class _ASGIResponse:
    """Django HttpResponse-like wrapper providing cookie methods."""

    def __init__(self) -> None:
        self._cookies: list[
            tuple[str, str]
        ] = []  # (key, value) pairs set via set_cookie

    def set_cookie(
        self,
        key: str,
        value: str,
        **kwargs: object,  # type: ignore[override]
    ) -> None:
        self._cookies.append((key, value))

    def delete_cookie(self, key: str, **kwargs: object) -> None:  # type: ignore[override]
        self._cookies.append((key, ""))


class StrawberryDjangoCompatContext:
    """Context object that exposes ``.request`` / ``.response`` just like
    Strawberry's Django integration so resolvers need no changes."""

    def __init__(
        self,
        scope_headers: list[tuple[bytes, bytes]],
        response: _ASGIResponse | None = None,
    ) -> None:
        object.__setattr__(self, "request", _ASGIRequest(scope_headers))  # type: ignore[misc]
        object.__setattr__(self, "response", response or _ASGIResponse())

    def get(self, key: str) -> object:
        """Dict-like access matching StrawberryDjangoContext.get()."""
        return getattr(self, key, None)

    @property
    def user(self) -> "User | None":  # noqa: F821
        return getattr(self, "_user", None)

    @user.setter
    def user(self, value: object) -> None:
        object.__setattr__(self, "_user", value)


# ── Auth-aware ASGI GraphQL view (subclasses Strawberry's ASGI view) ──────


async def _lookup_user(user_id: UUID) -> "User | None":  # noqa: F821 - forward ref
    from apps.users.models import User as UserModel

    try:
        return await UserModel.objects.aget(id=user_id)
    except Exception:
        return None


class AuthGraphQLView:
    """Strawberry ASGI view that injects the authenticated user into context.

    Extracts ``Authorization: Bearer <token>`` on every request, decodes it,
    and places the resulting :class:`apps.users.models.User` on
    ``context.user`` (and keeps the standard ``context.request`` /
    ``context.response`` attrs so resolvers work unchanged).

    Usage::

        view = AuthGraphQLView(schema)
        await view(scope, receive, send)
    """

    def __init__(self, schema: object) -> None:  # type: ignore[override]
        from strawberry.asgi import GraphQL as _StrawberryASGI

        self._inner = _StrawberryASGI(schema=schema)  # type: ignore[arg-type]

    async def __call__(self, scope: dict, receive: object, send: object) -> None:
        if scope["type"] != "http":
            await self._inner(scope, receive, send)  # type: ignore[arg-type]
            return

        headers = scope.get("headers") or []
        response = _ASGIResponse()
        ctx = StrawberryDjangoCompatContext(headers, response=response)

        # Authenticate via Bearer token.
        user_id = await self._authenticate(headers)
        if user_id is not None:
            ctx.user = await _lookup_user(user_id)  # type: ignore[attr-defined]

        # Monkey-patch get_context on the inner view so Strawberry picks it up.
        original_get_context = self._inner.get_context  # type: ignore[attr-defined]

        async def patched_get_context(request, response):  # type: ignore[no-untyped-def]
            return ctx

        self._inner.get_context = patched_get_context  # type: ignore[attr-defined]

        try:
            await self._inner(scope, receive, send)  # type: ignore[arg-type]
        finally:
            self._inner.get_context = original_get_context  # type: ignore[attr-defined]

    @staticmethod
    async def _authenticate(headers: list[tuple[bytes, bytes]]) -> UUID | None:
        """Decode Authorization: Bearer token → user_id or None."""
        for k, v in headers:
            if k.lower() == b"authorization":
                auth = v.decode("utf-8")
                if auth.startswith("Bearer "):
                    token = auth[7:]
                    return decode_access_token(token)
        return None


# ── Cookie helpers for ASGI response ───────────────────────────────────────


def set_auth_cookie(response, token: str) -> None:  # type: ignore[name-defined]
    """Set JWT access_token cookie on the context.response object."""
    expires = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=_ACCESS_TOKEN_EXPIRE_MINUTES,
    )
    response.set_cookie(  # type: ignore[attr-defined]
        key="access_token",
        value=token,
        httponly=True,
        samesite="Lax",
        secure=dj_settings.DEBUG is False,  # type: ignore[attr-defined,union-attr]
        expires=expires,
        path="/graphql",
    )


def clear_auth_cookie(response) -> None:  # type: ignore[name-defined]
    """Clear the JWT access_token cookie from the context.response object."""
    response.delete_cookie("access_token", path="/graphql")  # type: ignore[attr-defined]


# ── Cookie helpers (legacy — kept for backwards compat with existing mutations) ────


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
    except jwt.PyJWTError, ValueError, KeyError:
        return None


async def get_current_user(info: Info) -> "User | None":  # noqa: F821 - forward ref
    """Resolve current authenticated user from Bearer token in Authorization header.

    Reads 'Authorization: Bearer <token>' header on every request.
    Returns a User instance or None if not authenticated.
    """
    request = info.context.request  # type: ignore[attr-defined]
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")  # type: ignore[union-attr]

    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]

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
