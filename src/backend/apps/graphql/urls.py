from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse, HttpRequest
from django.urls import path
from django.views.decorators.csrf import csrf_exempt

from strawberry.django.views import AsyncGraphQLView

from apps.graphql.auth import get_user_from_jwt_token
from apps.graphql.context import Context
from apps.graphql.schema import schema


class ChithiGraphQLView(AsyncGraphQLView):
    """GraphQL view with JWT-aware context.

    Resolves the authenticated user from the session or a Bearer token
    and exposes it on ``context.user`` for resolvers to read.
    """

    async def get_context(
        self, request: HttpRequest, response: HttpResponse
    ) -> Context:  # type: ignore[override]
        user: AnonymousUser = request.user

        if not user.is_authenticated:
            auth_header = request.META.get("HTTP_AUTHORIZATION", "")
            token = (
                auth_header.split("Bearer ", 1)[-1].strip()
                if "Bearer " in auth_header
                else ""
            )
            if token:
                resolved = get_user_from_jwt_token(token)
                if resolved is not None:
                    user = resolved

        return Context(request=request, user=user)


# csrf_exempt wraps the WSGI view callable returned by as_view()
graphql_view = csrf_exempt(
    ChithiGraphQLView.as_view(
        schema=schema,
        multipart_uploads_enabled=True,
    )
)

urlpatterns = [
    path("", graphql_view, name="graphql"),
]
