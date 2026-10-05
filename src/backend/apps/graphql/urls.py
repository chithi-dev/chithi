from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse, HttpRequest
from django.urls import path
from django.views.decorators.csrf import csrf_exempt

from strawberry.django.views import AsyncGraphQLView

from apps.graphql.context import Context
from apps.graphql.schema import schema


class ChithiGraphQLView(AsyncGraphQLView):
    """GraphQL view that exposes the request user on the context.

    ``request.user`` is already resolved by ``JwtAuthenticationMiddleware``
    (session or Bearer JWT), so this only forwards it to the context.
    """

    async def get_context(
        self, request: HttpRequest, response: HttpResponse
    ) -> Context:  # type: ignore[override]
        user: AnonymousUser = request.user
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
