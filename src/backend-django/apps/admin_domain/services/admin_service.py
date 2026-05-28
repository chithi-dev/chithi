from typing import Any


class AdminService:
    async def get_instance_stats(self) -> dict[str, int]:
        from apps.config.models import Config as _ConfigModel
        from apps.files.models import FileRecord
        from apps.reverse_rooms.models import Room
        from apps.users.models import User

        return {
            "users": await User.objects.acount(),
            "files": await FileRecord.objects.acount(),
            "rooms": await Room.objects.acount(),
            "config_exists": 1 if await _ConfigModel.get_config() else 0,
        }

    async def batch_delete_files(self, file_ids: list[str]) -> int:
        from apps.files.models import FileRecord
        from uuid import UUID

        ids = [UUID(fid) for fid in file_ids]
        return (await FileRecord.objects.filter(id__in=ids).adelete())[0] if ids else 0
