import re

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
        match = re.search(r"Bearer\s+(?P<token>\S+)", auth_header)
        if not match:
            return None

        token_string = match.group("token")
        user = get_user_from_jwt_token(token_string)
        if user:
            request.user = user
