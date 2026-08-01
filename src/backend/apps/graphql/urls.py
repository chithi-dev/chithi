from django.urls import path
from django.views.decorators.csrf import csrf_exempt

from strawberry.django.views import AsyncGraphQLView

from .schema import schema

# csrf_exempt wraps the WSGI view callable returned by as_view()
graphql_view = csrf_exempt(
    AsyncGraphQLView.as_view(
        schema=schema,
        multipart_uploads_enabled=True,
    )
)

urlpatterns = [
    path("", graphql_view, name="graphql"),
]
