from __future__ import annotations

import datetime

import strawberry


@strawberry.type
class FilesQueries:
    @strawberry.field
    async def files(
        self, info: strawberry.types.Info, page: int = 1, page_size: int = 10
    ) -> "list[FileOut]":  # type: ignore[name-defined]
        from apps.files.models import FileRecord as _File

        user = info.context.user  # type: ignore[union-attr]
        if not user:
            raise PermissionError("Authentication required")

        qs = _File.objects.all().order_by("-id")
        items = [r async for r in qs[(page - 1) * page_size : (page - 1) * page_size + page_size]]
        now = datetime.datetime.now(datetime.timezone.utc)

        return [
            FileOut(  # type: ignore[call-arg]
                id=item.id, filename=str(item.filename), size=int(item.size),
                expires_at=item.expires_at, expire_after_n_download=int(item.expire_after_n_download or 0),
                download_count=int(item.download_count or 0), created_at=item.created_at,
                is_expired=now > item.expires_at or (bool(item.expire_after_n_download) and int(item.download_count or 0) >= int(item.expire_after_n_download)),
            )
            for item in items
        ]

    @strawberry.field
    async def file_info(self, info: strawberry.types.Info, key: str) -> "FileInfoOut | None":  # type: ignore[name-defined]
        from apps.files.models import FileRecord as _File

        try:
            record = await _File.objects.aget(key=key)
        except _File.DoesNotExist:
            return None

        return FileInfoOut(  # type: ignore[call-arg]
            id=record.id, filename=str(record.filename), size=int(record.size),
            download_count=int(record.download_count or 0), created_at=int(record.created_at.timestamp()) if record.created_at else 0,
            expires_at=record.expires_at, expire_after_n_download=int(record.expire_after_n_download or 0),
        )


@strawberry.type
class Query(FilesQueries):
    pass
