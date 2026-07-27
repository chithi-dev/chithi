from datetime import datetime

import strawberry
from strawberry_django import type

from apps.files.models import File
from apps.graphql.types.scalars import BigInt


@type(model=File)
class FileType:
    id: strawberry.ID
    key: str
    filename: str
    size: BigInt
    number_of_files: int | None
    download_count: int
    created_at: datetime
    expires_at: datetime
    expire_after_n_download: int
    is_expired: bool


@strawberry.type
class FileChunk:
    """A chunk of file data for streaming downloads."""
    data: str  # base64 encoded chunk
    index: int
    is_last: bool


@strawberry.type
class PaginatedFiles:
    items: list[FileType]
    total: int
    page: int
    size: int
    pages: int