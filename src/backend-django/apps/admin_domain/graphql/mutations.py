from __future__ import annotations

import strawberry

from apps.admin_domain.graphql.types import BatchDeleteResult
from apps.admin_domain.services.admin_service import AdminService


@strawberry.type
class AdminMutations:
    @strawberry.mutation
    async def batch_delete_files(
        self,
        info: strawberry.types.Info,
        file_ids: list[str],
    ) -> BatchDeleteResult:
        await AdminService._require_auth(info)  # type: ignore[arg-type]
        service = AdminService()
        deleted = await service.batch_delete_files(file_ids)
        return BatchDeleteResult(deleted_count=deleted)


@strawberry.type
class Mutation(AdminMutations):
    pass
