import strawberry
from asgiref.sync import sync_to_async
from django.core.paginator import Paginator
from django.db.models import Sum, Count, Q
from django.utils import timezone

from apps.files.models import File
from apps.graphql.types import FileType, PaginatedFiles, InstanceStatisticsType


@strawberry.type
class FileQuery:
    # ── Files ──
    @strawberry.field
    async def files(self) -> list[FileType]:
        return await sync_to_async(list)(File.objects.all())

    @strawberry.field
    async def file_info(self, key: str) -> FileType | None:
        """Look up a file by its ID (UUID) or S3 key."""
        from uuid import UUID

        try:
            file_id = UUID(key)
            return await sync_to_async(File.objects.get)(id=file_id)
        except (File.DoesNotExist, ValueError):
            pass

        try:
            return await sync_to_async(File.objects.get)(key=key)
        except File.DoesNotExist:
            return None

    # ── Admin Files (paginated) ──
    @strawberry.field
    async def admin_files(
        self,
        page: int = 1,
        size: int = 10,
        search: str | None = None,
    ) -> PaginatedFiles:
        qs = File.objects.all().order_by("-created_at")
        if search:
            qs = qs.filter(filename__icontains=search)

        def _paginate():
            paginator = Paginator(qs, size)
            page_obj = paginator.get_page(page)
            return PaginatedFiles(
                items=list(page_obj),
                total=paginator.count,
                page=page,
                size=size,
                pages=paginator.num_pages,
            )

        return await sync_to_async(_paginate)()

    # ── Instance Statistics ──
    @strawberry.field
    async def instance_statistics(self) -> InstanceStatisticsType:
        from django.contrib.auth import get_user_model

        now = timezone.now()
        User = get_user_model()

        def get_stats():
            stats = File.objects.aggregate(
                total_files=Count("pk"),
                active_files=Count("pk", filter=Q(expires_at__gt=now)),
                expired_files=Count("pk", filter=Q(expires_at__lte=now)),
                total_storage_used=Sum("size"),
            )
            return InstanceStatisticsType(
                total_files=stats["total_files"] or 0,
                active_files=stats["active_files"] or 0,
                expired_files=stats["expired_files"] or 0,
                total_storage_used=stats["total_storage_used"] or 0,
                total_users=User.objects.count(),
            )

        return await sync_to_async(get_stats)()
