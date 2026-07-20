"""Middleware that resolves JWT Bearer tokens for GraphQL requests."""

from .auth import get_user_from_jwt_token


class GraphQLJwtMiddleware:
    """Resolve JWT tokens for GraphQL requests only."""

    def __init__(self, get_response) -> None:
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_view(self, request, view_func, view_args, view_kwargs) -> None:
        if not request.path_info.startswith("/graphql"):
            return None

        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None

        token_string = auth_header.split("Bearer ", 1)[1].strip()
        user = get_user_from_jwt_token(token_string)
        if user:
            request.user = user
