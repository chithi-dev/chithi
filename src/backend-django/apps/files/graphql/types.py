from __future__ import annotations

import datetime
import strawberry


@strawberry.type
class FileOut:
    id: strawberry.ID
    filename: str
    size: int
    expires_at: datetime.datetime
    expire_after_n_download: int
    download_count: int
    created_at: datetime.datetime
    is_expired: bool
    number_of_files: int | None = None


@strawberry.type
class FileInfoOut:
    id: strawberry.ID
    filename: str
    size: int
    download_count: int
    created_at: int  # unix timestamp
    expires_at: datetime.datetime
    expire_after_n_download: int
    number_of_files: int | None = None


@strawberry.type
class DeleteResult:
    key: str


@strawberry.type
class UploadResult:
    key: str


@strawberry.type
class DownloadMeta:
    filename: str
    size: int
