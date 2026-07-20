from datetime import datetime

import strawberry
from strawberry_django import type

from apps.files.models import File


@type(model=File)
class FileType:
    id: strawberry.ID
    key: str
    filename: str
    size: int
    number_of_files: int | None
    download_count: int
    created_at: datetime
    expires_at: datetime
    expire_after_n_download: int
    is_expired: bool


@strawberry.type
class PaginatedFiles:
    items: list[FileType]
    total: int
    page: int
    size: int
    pages: int
