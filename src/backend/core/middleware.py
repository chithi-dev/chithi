import asyncio
import logging
import re

from django.contrib.auth.models import AnonymousUser

from apps.graphql.auth import get_user_from_jwt_token

logger = logging.getLogger(__name__)


class GraphQLJwtMiddleware:
    """Resolve JWT tokens for GraphQL requests only.

    Hybrid middleware — detects whether the downstream view is sync or
    async and routes through the correct path so this works inside an
    ASGI stack (the GraphQL view is async) as well as plain WSGI.
    """

    def __init__(self, get_response) -> None:
        self.get_response = get_response
        if asyncio.iscoroutinefunction(get_response):
            self._authenticate_then_call = self._async
        else:
            self._authenticate_then_call = self._sync

    def __call__(self, request):
        return self._authenticate_then_call(request)

    def _sync(self, request):
        self._authenticate(request)
        return self.get_response(request)

    async def _async(self, request):
        self._authenticate(request)
        return await self.get_response(request)

    @staticmethod
    def _authenticate(request) -> None:
        path = getattr(request, "path_info", "") or getattr(request, "path", "")
        if not path.startswith("/graphql"):
            return

        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        match = re.search(r"Bearer\s+(?P<token>\S+)", auth_header)
        if not match:
            return

        token_string = match.group("token")
        user = get_user_from_jwt_token(token_string)
        if user is not None and not isinstance(user, AnonymousUser):
            # ``request.user`` is a property backed by a SimpleLazyObject
            # from Django's auth middleware. Setting it directly overrides
            # the lazy value so downstream resolvers see the JWT-authed user.
            request._cached_user = user
            request.user = user
