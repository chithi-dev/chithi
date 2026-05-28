
from __future__ import annotations

import strawberry


@strawberry.type
class DeleteResult:
    """Result of a single file deletion."""
    id: str


@strawberry.type
class BatchDeleteResult:
    """Result of batch-delete mutation."""
    deleted_count: int


@strawberry.type
class InstanceStatsOut:
    """Aggregate instance statistics for the admin dashboard."""
    users: int
    files: int
    rooms: int
    config_exists: int
