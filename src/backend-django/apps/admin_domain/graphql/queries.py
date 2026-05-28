from __future__ import annotations

import strawberry

from apps.admin_domain.graphql.types import InstanceStatsOut


@strawberry.type
class AdminQueries:
    @strawberry.field
    async def instance_stats(self, info: strawberry.types.Info) -> InstanceStatsOut:
        user = info.context.user  # type: ignore[union-attr]
        if not getattr(user, "is_staff", False):  # type: ignore[union-attr]
            raise PermissionError("Admin access required")

        from apps.config.models import Config as _ConfigModel
        from apps.files.models import FileRecord
        from apps.reverse_rooms.models import Room
        from apps.users.models import User

        stats = {
            "users": await User.objects.acount(),
            "files": await FileRecord.objects.acount(),
            "rooms": await Room.objects.acount(),
            "config_exists": 1 if await _ConfigModel.get_config() else 0,
        }
        return InstanceStatsOut(
            users=stats["users"], files=stats["files"], rooms=stats["rooms"],
            config_exists=bool(stats.get("config_exists")),
        )


@strawberry.type
class Query(AdminQueries):
    pass
