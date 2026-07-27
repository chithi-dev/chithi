import platform
import sys
import strawberry
from strawberry.types import Info
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from django.core.paginator import Paginator
from django.db.models import Sum
from django.utils import timezone

from apps.config.models import Config
from apps.files.models import File
from apps.graphql.types import (
    ConfigType,
    FileType,
    InstanceInfoType,
    InstanceStatisticsType,
    OnboardingType,
    PaginatedFiles,
    UserType,
)


@strawberry.type
class Query:
    # ── Config ──
    @strawberry.field
    async def config(self) -> ConfigType:
        return await sync_to_async(Config.load)()

    # ── Files ──
    @strawberry.field
    async def files(self) -> list[FileType]:
        return await sync_to_async(list)(File.objects.all())

    @strawberry.field
    async def file_info(self, key: str) -> FileType | None:
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
        paginator = Paginator(qs, size)
        page_obj = paginator.get_page(page)
        return PaginatedFiles(
            items=list(page_obj),
            total=paginator.count,
            page=page,
            size=size,
            pages=paginator.num_pages,
        )

    # ── Instance ──
    @strawberry.field
    async def instance_information(self) -> InstanceInfoType:
        return InstanceInfoType(
            backend_version="0.1.0",
            python_version=sys.version,
            platform=platform.system(),
        )

    @strawberry.field
    async def instance_statistics(self) -> InstanceStatisticsType:
        from django.db.models import BooleanField, Case, Count, Q, Sum, When, Value

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

    # ── Onboarding ──
    @strawberry.field
    async def onboarding(self) -> OnboardingType:
        User = get_user_model()
        try:
            await sync_to_async(Config.load)()
            is_configured = True
        except Config.DoesNotExist:
            is_configured = False
        return OnboardingType(
            is_configured=is_configured,
            has_users=await sync_to_async(User.objects.exists)(),
        )

    # ── Users ──
    @strawberry.field
    async def users(self) -> list[UserType]:
        User = get_user_model()
        return await sync_to_async(list)(User.objects.all())

    @strawberry.field
    async def me(self, info: Info) -> UserType | None:
        user = info.context.request.user
        return user if user and user.is_authenticated else None


__all__ = ["Query"]
