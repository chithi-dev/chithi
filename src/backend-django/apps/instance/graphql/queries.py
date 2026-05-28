"""Instance GraphQL queries."""

from __future__ import annotations

import strawberry

from apps.instance.graphql.types import (
    AdminStatsOut,
    InstanceInfoOut,
    InstanceStatisticsOut,
)
from apps.instance.services.instance_service import (
    InstanceService,
    get_postgres_version,
    get_redis_version,
)


@strawberry.type
class InstanceQueries:
    @strawberry.field
    async def instance_information(self) -> InstanceInfoOut:
        """Get server instance information (no auth)."""
        service = InstanceService()
        info = await service.get_instance_info()
        redis_version = await get_redis_version()
        postgres_version = await get_postgres_version()

        commit = info.get("commit", "") or ""
        version = info.get("version", "") or ""
        is_release = bool(version) and not commit.startswith(("00000000", "unknown"))

        return InstanceInfoOut(  # type: ignore[call-arg]
            python_version=info["python_version"],
            django_version=".".join(str(v) for v in info["django_version"]),
            redis_version=redis_version,
            postgres_version=postgres_version,
            version=version,
            commit=commit,
            is_release=is_release,
        )

    @strawberry.field
    async def instance_statistics(self) -> InstanceStatisticsOut:
        """Get aggregate statistics (no auth)."""
        service = InstanceService()
        stats = await service.get_instance_statistics()
        return InstanceStatisticsOut(  # type: ignore[call-arg]
            total_bytes=stats["total_bytes"],
            total_files=stats["total_files"],
            total_downloads=stats["total_downloads"],
            active_urls=stats["active_urls"],
            active_rooms=stats["active_rooms"],
            links_with_download_caps=stats["links_with_download_caps"],
            expiring_soon=stats["expiring_soon"],
            latest_expiry=stats.get("latest_expiry"),
        )

    @strawberry.field
    async def admin_stats(self, info: strawberry.types.Info) -> AdminStatsOut:
        """Aggregate instance statistics (auth required)."""
        from core.auth.jwt_auth import get_current_user

        user = await get_current_user(info)
        if not user or not getattr(user, "is_staff", False):  # type: ignore[union-attr]
            raise PermissionError("Admin access required")

        stats = {}

        from apps.config.models import Config as ConfigModel
        from apps.files.models import FileRecord
        from apps.reverse_rooms.models import Room
        from apps.users.models import User  # noqa: F811

        stats["users"] = await User.objects.acount()
        stats["files"] = await FileRecord.objects.acount()
        stats["rooms"] = await Room.objects.acount()
        try:
            await ConfigModel.get_config()  # type: ignore[attr-defined]
            stats["config_exists"] = 1
        except Exception:
            stats["config_exists"] = 0

        return AdminStatsOut(  # type: ignore[call-arg]
            users=stats["users"],
            files=stats["files"],
            rooms=stats["rooms"],
            config_exists=stats["config_exists"],
        )


@strawberry.type
class Query(InstanceQueries):
    pass
