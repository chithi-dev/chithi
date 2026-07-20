import math

import strawberry
from strawberry.types import Info

from apps.files.models import File
from apps.graphql.types import PaginatedFiles


@strawberry.type
class AdminQueries:
    @strawberry.field
    def admin_files(
        self,
        info: Info,
        page: int = 1,
        size: int = 10,
        search: str | None = None,
    ) -> PaginatedFiles:
        """Paginated file list for admin with optional search."""
        user = info.context.request.user
        if not user.is_authenticated:
            raise PermissionError("Authentication required")

        queryset = File.objects.all()

        if search:
            queryset = queryset.filter(filename__icontains=search)

        total = queryset.count()
        pages = max(1, math.ceil(total / size))
        start = (page - 1) * size
        items = list(queryset.order_by("-created_at")[start : start + size])

        return PaginatedFiles(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
        )
