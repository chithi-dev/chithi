"""Admin queries for the GraphQL API."""

import math

import strawberry
from strawberry.types import Info

from apps.files.models import File
from apps.graphql.types import PaginatedFiles


class PermissionDenied(Exception):
    pass


@strawberry.type
class AdminQueries:
    """Admin-only queries requiring authentication."""

    @strawberry.field
    def admin_files(
        self,
        info: Info,
        page: int = 1,
        size: int = 10,
        search: str | None = None,
    ) -> PaginatedFiles:
        user = info.context.request.user
        if not user or not user.is_superuser:
            raise PermissionDenied("You are not authorized")

        queryset = File.objects.all()
        if search:
            queryset = queryset.filter(filename__icontains=search)

        total = queryset.count()
        pages = math.ceil(total / size) if total else 1
        items = queryset[(page - 1) * size : page * size]

        return PaginatedFiles(
            items=list(items),
            total=total,
            page=page,
            size=size,
            pages=pages,
        )
