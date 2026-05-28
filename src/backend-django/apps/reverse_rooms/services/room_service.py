from __future__ import annotations

import datetime
import hashlib
import uuid as _uuid
from typing import Any


class RoomService:
    """All reverse-rooms-related business logic."""

    @classmethod
    async def create_room(
        cls,
        name: str,
        expire_after: int,
        number_of_downloads: int | None = None,
    ) -> dict[str, Any]:
        """Create a new room and return its details with host_token.

        Returns dict with room id, name, created_at, expires_at, expire_after,
        number_of_downloads, files (empty list), active_uploads_count=0, host_token.
        """
        from apps.reverse_rooms.models import Room, RoomHost

        now = datetime.datetime.now(datetime.timezone.utc)
        expires_at = now + datetime.timedelta(seconds=max(1, expire_after))

        room = await Room.objects.acreate(
            name=name,
            expire_after=expire_after,
            number_of_downloads=number_of_downloads,
            expires_at=expires_at,
        )

        # Generate and store host token
        raw_token = str(_uuid.uuid4())
        host_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

        await RoomHost.objects.acreate(room=room, host_token=host_hash)

        return {
            "id": room.id,
            "name": room.name,
            "created_at": room.created_at,
            "expires_at": expires_at,
            "expire_after": expire_after,
            "number_of_downloads": number_of_downloads,
            "files": [],
            "active_uploads_count": 0,
            "host_token": raw_token,
        }

    @classmethod
    async def get_room(cls, room_id: _uuid.UUID) -> dict[str, Any] | None:
        """Get a room by ID with its files."""
        from apps.reverse_rooms.models import Room, RoomFile

        try:
            room = await Room.objects.aget(id=room_id)  # type: ignore[arg-type]
        except Room.DoesNotExist:
            return None

        files_qs = RoomFile.objects.filter(room=room).order_by("-uploaded_at")
        files_list = [
            {
                "key": f.key,
                "filename": f.filename,
                "size": int(f.size),
                "uploaded_at": f.uploaded_at,
            }
            async for f in files_qs
        ]

        return {
            "id": room.id,
            "name": room.name,
            "created_at": room.created_at,
            "expires_at": room.expires_at,
            "expire_after": room.expire_after,
            "number_of_downloads": room.number_of_downloads,
            "files": files_list,
            "active_uploads_count": len(files_list),
        }

    @classmethod
    async def delete_room(cls, room_id: _uuid.UUID, host_token_raw: str) -> bool:
        """Delete a room (and its files) if the host token matches."""
        from apps.reverse_rooms.models import Room, RoomFile, RoomHost

        try:
            room = await Room.objects.aget(id=room_id)  # type: ignore[arg-type]
        except Room.DoesNotExist:
            return False

        host_hash = hashlib.sha256(host_token_raw.encode("utf-8")).hexdigest()

        # Verify host token matches
        try:
            host = await RoomHost.objects.aget(room=room, host_token=host_hash)  # type: ignore[arg-type]
        except RoomHost.DoesNotExist:
            return False

        # Schedule async S3 deletions for all room files via django-tasks
        from apps.files.tasks import delete_file_storage_task
        file_entries = await RoomFile.objects.filter(room=room).avalues_list("key", flat=True)  # type: ignore[attr-defined]
        for key in file_entries:
            try:
                await delete_file_storage_task.schedule(args=[str(key)])
            except Exception:  # noqa: BLE001
                pass

        # Delete room files and then the room itself (CASCADE handles RoomFile)
        await room.adelete()
        return True

    @classmethod
    async def add_host(cls, room_id: _uuid.UUID, host_token_raw: str) -> dict[str, str]:
        """Add a new host token to an existing room. Returns 201 status."""
        from apps.reverse_rooms.models import Room, RoomHost

        try:
            await Room.objects.aget(id=room_id)  # type: ignore[arg-type]
        except Room.DoesNotExist:
            raise ValueError(f"Room {room_id} not found")

        host_hash = hashlib.sha256(host_token_raw.encode("utf-8")).hexdigest()
        await RoomHost.objects.acreate(room_id=room_id, host_token=host_hash)

        return {"host_token": host_hash}

    @classmethod
    async def upload_file_to_room(
        cls, room_id: _uuid.UUID, key: str, filename: str, size: int, uploaded_at: datetime.datetime | None = None
    ) -> dict[str, Any]:
        """Record a file in a reverse room."""
        from apps.reverse_rooms.models import Room, RoomFile

        try:
            await Room.objects.aget(id=room_id)  # type: ignore[arg-type]
        except Room.DoesNotExist:
            raise ValueError(f"Room {room_id} not found")

        ts = uploaded_at or datetime.datetime.now(datetime.timezone.utc)
        room_file = await RoomFile.objects.acreate(
            room_id=room_id, key=key, filename=filename, size=size, uploaded_at=ts
        )

        return {
            "key": room_file.key,
            "filename": room_file.filename,
            "size": int(room_file.size),
            "uploaded_at": room_file.uploaded_at,
        }

    @classmethod
    async def list_room_files(cls, room_id: _uuid.UUID) -> list[dict[str, Any]] | None:
        """List files in a room."""
        from apps.reverse_rooms.models import Room, RoomFile

        try:
            await Room.objects.aget(id=room_id)  # type: ignore[arg-type]
        except Room.DoesNotExist:
            return None

        files_qs = RoomFile.objects.filter(room_id=room_id).order_by("-uploaded_at")
        return [
            {
                "key": f.key,
                "filename": f.filename,
                "size": int(f.size),
                "uploaded_at": f.uploaded_at.isoformat() if f.uploaded_at else None,  # type: ignore[union-attr]
            }
            async for f in files_qs
        ]
