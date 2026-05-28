from __future__ import annotations

import datetime
import strawberry
from typing import List, Optional

from apps.files.graphql.types import (
    FileOut, FileInfoOut
)
from apps.files.services.file_service import FileService


@strawberry.type
class FilesQueries:
    @strawberry.field
    async def files(
        self,
        info: strawberry.types.Info,
        page: int = 1,
        page_size: int = 10,
    ) -> List[FileOut]:
        """Paginated list of all files (auth required), ordered by id desc."""
        from core.auth.jwt_auth import get_current_user
        user = await _get_current_user(info)
        if not user:
            raise PermissionError("Authentication required")

        service = FileService()
        items, meta = await service.get_paginated_files(page=page, page_size=page_size)

        now = datetime.datetime.now(datetime.timezone.utc)
        return [
            FileOut(
                id=item.id,
                filename=str(item.filename),
                size=int(item.size),
                expires_at=item.expires_at,
                expire_after_n_download=int(item.expire_after_n_download or 0),
                download_count=int(item.download_count or 0),
                created_at=item.created_at,
                is_expired=now > item.expires_at or (
                    bool(item.expire_after_n_download) and int(item.download_count or 0) >= int(item.expire_after_n_download)
                ),
            )
            for item in items
        ]

    @strawberry.field
    async def file_info(
        self,
        info: strawberry.types.Info,
        key: str,
    ) -> Optional[FileInfoOut]:
        """Get file info by storage key (public)."""
        service = FileService()
        record = await service.get_file_by_key(key)
        if not record:
            return None

        created_ts = int(record.created_at.timestamp()) if record.created_at else 0

        return FileInfoOut(
            id=record.id,
            filename=str(record.filename),
            size=int(record.size),
            download_count=int(record.download_count or 0),
            created_at=created_ts,
            expires_at=record.expires_at,
            expire_after_n_download=int(record.expire_after_n_download or 0),
        )


@strawberry.type
class Query(FilesQueries):
    pass
