
from __future__ import annotations

import strawberry

from apps.admin_domain.graphql.types import InstanceStatsOut
from apps.admin_domain.services.admin_service import AdminService


@strawberry.type
class AdminQueries:
    @strawberry.field
    async def instance_stats(self, info: strawberry.types.Info) -> InstanceStatsOut:
        """Aggregate instance statistics (auth required)."""
        await AdminService._require_auth(info)  # type: ignore[arg-type]
        service = AdminService()
        stats = await service.get_instance_stats()
        return InstanceStatsOut(
            users=stats["users"],
            files=stats["files"],
            rooms=stats["rooms"],
            config_exists=stats["config_exists"],
        )

    @staticmethod
    async def _require_auth(info: strawberry.types.Info) -> None:
        """Require authentication for admin endpoints."""
        from core.auth.jwt_auth import require_auth as _auth
        user = _auth(info)  # type: ignore[arg-type]
        if not getattr(user, "is_staff", False):
            raise PermissionError("Admin access required")


@strawberry.type
class Query(AdminQueries):
    pass  # top-level Query assembled in schema.py
