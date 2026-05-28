from __future__ import annotations

import datetime
import hashlib
import uuid as _uuid
from typing import Any


class RoomService:
    @classmethod
    async def create_room(cls, name: str, expire_after: int, number_of_downloads: int | None = None) -> dict[str, Any]:
        from apps.reverse_rooms.models import Room, RoomHost

        now = datetime.datetime.now(datetime.timezone.utc)
        room = await Room.objects.acreate(  # type: ignore[return-value]
            name=name, expire_after=expire_after, number_of_downloads=number_of_downloads,
            expires_at=now + datetime.timedelta(seconds=max(1, expire_after)),
        )

        raw_token = str(_uuid.uuid4())
        host_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        await RoomHost.objects.acreate(room=room, host_token=host_hash)  # type: ignore[arg-type]

        return {
            "id": room.id, "name": room.name, "created_at": room.created_at,
            "expires_at": now + datetime.timedelta(seconds=max(1, expire_after)),
            "expire_after": expire_after, "number_of_downloads": number_of_downloads,
            "files": [], "active_uploads_count": 0, "host_token": raw_token,
        }

    @classmethod
    async def get_room(cls, room_id: _uuid.UUID) -> dict[str, Any] | None:  # type: ignore[arg-type]
        from apps.reverse_rooms.models import Room, RoomFile

        try:
            room = await Room.objects.aget(id=room_id)
        except Room.DoesNotExist:
            return None

        files_qs = RoomFile.objects.filter(room=room).order_by("-uploaded_at")
        files_list = [{"key": f.key, "filename": f.filename, "size": int(f.size), "uploaded_at": f.uploaded_at} async for f in files_qs]

        return {
            "id": room.id, "name": room.name, "created_at": room.created_at,
            "expires_at": room.expires_at, "expire_after": room.expire_after,
            "number_of_downloads": room.number_of_downloads, "files": files_list,
            "active_uploads_count": len(files_list),
        }

    @classmethod
    async def delete_room(cls, room_id: _uuid.UUID, host_token_raw: str) -> bool:
        from apps.files.tasks import delete_file_storage_task
        from apps.reverse_rooms.models import Room, RoomFile, RoomHost

        try:
            room = await Room.objects.aget(id=room_id)
        except Room.DoesNotExist:
            return False

        host_hash = hashlib.sha256(host_token_raw.encode("utf-8")).hexdigest()
        try:
            await RoomHost.objects.aget(room=room, host_token=host_hash)  # type: ignore[arg-type]
        except RoomHost.DoesNotExist:
            return False

        for key in [f async for f in RoomFile.objects.filter(room=room).avalues_list("key", flat=True)]:  # type: ignore[attr-defined]
            try:
                await delete_file_storage_task.aenqueue(str(key))
            except Exception:
                pass

        await room.adelete()
        return True

    @classmethod
    async def add_host(cls, room_id: _uuid.UUID, host_token_raw: str) -> dict[str, str]:
        from apps.reverse_rooms.models import RoomHost

        await RoomHost.objects.acreate(room_id=room_id, host_token=hashlib.sha256(host_token_raw.encode("utf-8")).hexdigest())  # type: ignore[arg-type]
        return {"host_token": hashlib.sha256(host_token_raw.encode("utf-8")).hexdigest()}
