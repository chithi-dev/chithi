"""URL configuration for core project."""

from django.contrib import admin
from django.http import HttpResponse
from django.urls import path
from strawberry.django.views import (
    AsyncGraphQLView as _AsyncGraphQLView,
    TemporalHttpResponse,
)

from core.auth.jwt_auth import decode_access_token
from core.graphql import schema


class AuthGraphQLView(_AsyncGraphQLView):  # type: ignore[misc]
    """Django view that injects authenticated user into resolver context."""

    async def get_context(self, request, response):  # type: ignore[override]
        django_response = response if isinstance(response, HttpResponse) else TemporalHttpResponse()  # type: ignore[name-defined]
        compat_ctx = _AsyncGraphQLView.get_context(self, request, django_response)  # type: ignore[arg-type]

        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        user_id = None
        if auth_header.startswith("Bearer "):
            user_id = decode_access_token(auth_header[7:])

        from apps.users.models import User as UserModel

        if user_id is not None:
            try:
                compat_ctx.user = await UserModel.objects.aget(id=user_id)  # type: ignore[attr-defined]
            except Exception:  # noqa: BLE001
                pass

        return compat_ctx


urlpatterns = [
    path("admin/", admin.site.urls),
    path(
        "graphql",
        AuthGraphQLView.as_view(schema=schema, allow_queries_via_get=True),  # type: ignore[arg-type]
    ),
]
