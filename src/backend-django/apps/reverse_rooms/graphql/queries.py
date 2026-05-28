from __future__ import annotations

import datetime
from uuid import UUID as _UUID

import strawberry


@strawberry.type
class ReverseRoomsQueries:
    @strawberry.field
    async def room(self, info: strawberry.types.Info, id: strawberry.ID) -> "RoomOut | None":  # type: ignore[name-defined]
        from apps.reverse_rooms.graphql import types as _types
        from apps.reverse_rooms.models import Room as _Room

        from apps.reverse_rooms.models import Room as _Room, RoomFile

        try:
            room = await _Room.objects.aget(id=_UUID(str(id)))
        except Exception:
            return None

        files_list = [{"key": f.key, "filename": f.filename, "size": int(f.size), "uploaded_at": f.uploaded_at} async for f in RoomFile.objects.filter(room=room).order_by("-uploaded_at")]  # noqa: F841

        return _types.RoomOut(  # type: ignore[call-arg,name-defined]
            id=room.id, name=room.name, created_at=room.created_at, expires_at=room.expires_at,
            expire_after=room.expire_after, number_of_downloads=room.number_of_downloads,
            files=[_types.RoomFileEntry(key=f["key"], filename=f["filename"], size=f["size"], uploaded_at=f["uploaded_at"]) for f in files_list])

    @strawberry.field
    async def rooms(self, info: strawberry.types.Info) -> "list[RoomOut]":  # type: ignore[name-defined]
        from apps.reverse_rooms.graphql import types as _types
        from apps.reverse_rooms.models import Room as _Room, RoomFile as _RF

        result_list: list["_types.RoomOut"] = []
        async for room in _Room.objects.all().order_by("-created_at"):
            files_list = [
                _types.RoomFileEntry(key=f.key, filename=f.filename, size=int(f.size), uploaded_at=f.uploaded_at or datetime.datetime.now(datetime.timezone.utc))  # noqa: F821
                async for f in _RF.objects.filter(room=room).order_by("-uploaded_at")]

            result_list.append(_types.RoomOut(  # type: ignore[call-arg]
                id=room.id, name=room.name, created_at=room.created_at, expires_at=room.expires_at,
                expire_after=room.expire_after, number_of_downloads=room.number_of_downloads, files=files_list))

        return result_list

    @strawberry.field
    async def room_files(self, info: strawberry.types.Info, id: strawberry.ID) -> "list[RoomFileEntry]":  # type: ignore[name-defined]
        from apps.reverse_rooms.graphql import types as _types
        from apps.reverse_rooms.models import RoomFile as _RF

        files_qs = _RF.objects.filter(room_id=id).order_by("-uploaded_at")
        return [_types.RoomFileEntry(key=f.key, filename=f.filename, size=int(f.size), uploaded_at=f.uploaded_at) async for f in files_qs if f.uploaded_at]


@strawberry.type
class Query(ReverseRoomsQueries):
    pass
