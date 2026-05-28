from __future__ import annotations

import uuid

import strawberry

from apps.admin_domain.graphql.types import BatchDeleteResult


@strawberry.type
class AdminMutations:
    @strawberry.mutation
    async def batch_delete_files(
        self, info: strawberry.types.Info, file_ids: list[str]
    ) -> BatchDeleteResult:
        from apps.files.models import FileRecord

        user = info.context.user  # type: ignore[union-attr]
        if not user or not getattr(user, "is_staff", False):
            raise PermissionError("Admin access required")

        deleted = (
            await FileRecord.objects.filter(
                id__in=[uuid.UUID(fid) for fid in file_ids]
            ).adelete()
        )[0]
        return BatchDeleteResult(deleted_count=deleted)


@strawberry.type
class Mutation(AdminMutations):
    pass
