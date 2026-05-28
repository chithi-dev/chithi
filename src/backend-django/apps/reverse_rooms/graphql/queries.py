from __future__ import annotations

import datetime
import strawberry
from typing import List, Optional
from uuid import UUID

from apps.reverse_rooms.graphql.types import (
    RoomOut, RoomFileEntry
)
from apps.reverse_rooms.services.room_service import RoomService


@strawberry.type
class ReverseRoomsQueries:
    @strawberry.field
    async def room(self, info: strawberry.types.Info, id: strawberry.ID) -> Optional[RoomOut]:
        """Get a single room by ID (no auth required)."""
        service = RoomService()
        result = await service.get_room(UUID(id))  # type: ignore[arg-type]
        if not result:
            return None

        files_list = [
            RoomFileEntry(
                key=f["key"],
                filename=f["filename"],
                size=f["size"],
                uploaded_at=f["uploaded_at"],
            )
            for f in result.get("files", [])
        ]

        return RoomOut(
            id=result["id"],
            name=result["name"],
            created_at=result["created_at"],
            expires_at=result["expires_at"],
            expire_after=result["expire_after"],
            number_of_downloads=result.get("number_of_downloads"),
            files=files_list,
        )

    @strawberry.field
    async def rooms(self, info: strawberry.types.Info) -> List[RoomOut]:
        """List all rooms (no auth required)."""
        from apps.reverse_rooms.models import Room, RoomFile

        rooms_qs = Room.objects.all().order_by("-created_at")
        result_list: List[RoomOut] = []

        async for room in rooms_qs:
            files_qs = RoomFile.objects.filter(room=room).order_by("-uploaded_at")
            files_list = [
                RoomFileEntry(
                    key=f.key,  # type: ignore[arg-type]
                    filename=f.filename,  # type: ignore[arg-type]
                    size=int(f.size),  # type: ignore[union-attr]
                    uploaded_at=f.uploaded_at if f.uploaded_at else datetime.datetime.now(datetime.timezone.utc),  # type: ignore[union-attr]
                )
                async for f in files_qs
            ]

            result_list.append(
                RoomOut(
                    id=room.id,
                    name=room.name,
                    created_at=room.created_at,
                    expires_at=room.expires_at,
                    expire_after=room.expire_after,
                    number_of_downloads=room.number_of_downloads,
                    files=files_list,
                )
            )

        return result_list

    @strawberry.field
    async def room_files(
        self, info: strawberry.types.Info, id: strawberry.ID
    ) -> List[RoomFileEntry]:
        """List files in a room (no auth required)."""
        service = RoomService()
        result = await service.list_room_files(UUID(id))  # type: ignore[arg-type]
        if not result:
            return []

        return [
            RoomFileEntry(
                key=f["key"],
                filename=f["filename"],
                size=f["size"],
                uploaded_at=datetime.datetime.fromisoformat(f["uploaded_at"]) if isinstance(f.get("uploaded_at"), str) else f.get("uploaded_at", datetime.datetime.now(datetime.timezone.utc)),  # type: ignore[arg-type]
            )
            for f in result
        ]


@strawberry.type
class Query(ReverseRoomsQueries):
    pass
