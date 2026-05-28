"""URL configuration for core project."""

from django.contrib import admin
from django.urls import path
from strawberry.django.views import AsyncGraphQLView

from core.graphql import schema

urlpatterns = [
    path("admin/", admin.site.urls),
    path(
        "graphql",
        AsyncGraphQLView(schema=schema, allow_queries_via_get=True),  # type: ignore[arg-type]
    ),
]
