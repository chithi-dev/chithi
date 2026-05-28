from __future__ import annotations

import datetime
import strawberry
from typing import List, Optional


@strawberry.type
class PaginationInfo:
    """Pagination metadata for list queries."""
    total_items: int
    current_page: int
    page_size: int
    total_pages: int


@strawberry.type
class FileOut:
    """Public file info with expiry status."""
    id: strawberry.ID
    filename: str
    size: int
    expires_at: datetime.datetime
    expire_after_n_download: int
    download_count: int
    created_at: datetime.datetime
    is_expired: bool
    number_of_files: Optional[int] = None


@strawberry.type
class FileInfoOut:
    """File info by storage key (public)."""
    id: strawberry.ID
    filename: str
    size: int
    download_count: int
    created_at: datetime.datetime  # Changed to match FastAPI ISO format
    expires_at: datetime.datetime
    expire_after_n_download: int
    number_of_files: Optional[int] = None


@strawberry.type
class PaginatedFilesOut:
    """Paginated file list with metadata."""
    items: List[FileOut]
    pagination: PaginationInfo


@strawberry.input
class FilterInput:
    """Optional filter parameters (placeholder for future expansion)."""
    expires_before: Optional[str] = None
    min_size: Optional[int] = None


@strawberry.type
class DeleteResult:
    key: str


@strawberry.type
class UploadResult:
    key: str


@strawberry.type
class DownloadMeta:
    """Metadata for a streamed download."""
    filename: str
    size: int
