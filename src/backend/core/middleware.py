"""JWT auth middleware.

Resolves the authenticated user from the ``Authorization: Bearer <token>``
header and assigns it to ``request.user``. Runs after ``AuthenticationMiddleware``
so a session user (when present) takes priority and the JWT only fills the gap.
"""

import re
from collections.abc import Awaitable, Callable

from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest, HttpResponse

from apps.graphql.auth import get_user_from_jwt_token

# Matches an ``Authorization: Bearer <token>`` header, capturing the token.
_BEARER_RE = re.compile(r"^Bearer\s+(\S+)$", re.IGNORECASE)


class JwtAuthenticationMiddleware:
    """Inject ``request.user`` from a Bearer JWT on every request."""

    def __init__(self, get_response: Callable[[HttpRequest], Awaitable[HttpResponse] | HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        self._resolve_user(request)
        return self.get_response(request)

    def _resolve_user(self, request: HttpRequest) -> None:
        # Session auth already set an authenticated user; nothing to do.
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            return

        match = _BEARER_RE.match(request.META.get("HTTP_AUTHORIZATION", ""))
        if match is None:
            return
        token = match.group(1)

        resolved = get_user_from_jwt_token(token)
        if resolved is not None:
            request.user = resolved
        else:
            # Leave the session user (likely AnonymousUser) in place.
            if user is None:
                request.user = AnonymousUser()
