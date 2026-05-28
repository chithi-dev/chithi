
from typing import Any

from apps.config.models import Config as ConfigModel
from apps.files.models import FileRecord
from apps.reverse_rooms.models import Room


class AdminService:
    """Business logic for admin dashboard queries."""

    async def get_instance_stats(self) -> dict[str, int]:
        """Return aggregate counts across all domain models."""
        stats: dict[str, Any] = {}

        # Users
        from apps.users.models import User  # noqa: F811
        stats["users"] = await User.objects.acount()

        # Files
        stats["files"] = await FileRecord.objects.acount()

        # Rooms (reverse_rooms)
        stats["rooms"] = await Room.objects.acount()

        # Config row exists?
        stats["config_exists"] = 1 if await ConfigModel.objects.aget_config() else 0

        return {k: int(v) for k, v in stats.items()}

    async def batch_delete_files(self, file_ids: list[str]) -> int:
        """Delete FileRecord rows by their UUID strings. Returns count deleted."""
        from uuid import UUID

        ids = [UUID(fid) for fid in file_ids if fid]
        if not ids:
            return 0
        result = await FileRecord.objects.filter(id__in=ids).adelete()
        return result[0] if isinstance(result, tuple) else int(result)
