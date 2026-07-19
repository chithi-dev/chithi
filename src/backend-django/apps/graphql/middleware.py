"""Middleware that resolves JWT Bearer tokens for GraphQL requests.

When the frontend sends a Bearer token to the /graphql/ endpoint, this
middleware validates the JWT and sets request.user so Strawberry's
info.context.request.user returns the authenticated user.
"""

from .auth import get_user_from_jwt_token


class GraphQLJwtMiddleware:
    """Resolve JWT tokens for GraphQL requests only."""

    def __init__(self, get_response) -> None:
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        return response

    def process_view(self, request, view_func, view_args, view_kwargs) -> None:
        """Before the view runs, resolve the user from JWT if present."""
        if not request.path_info.startswith("/graphql"):
            return None

        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None

        token_string = auth_header.split("Bearer ", 1)[1].strip()
        user = get_user_from_jwt_token(token_string)
        if user:
            request.user = user
        return None
