from __future__ import annotations

import datetime
import hashlib
import uuid as _uuid

import strawberry

from apps.reverse_rooms.graphql import types as _types


@strawberry.type
class ReverseRoomsMutations:
    @strawberry.mutation
    async def create_room(
        self, info: strawberry.types.Info, input: "RoomCreateInput"  # type: ignore[name-defined]
    ) -> "RoomCreateResult":  # type: ignore[name-defined]
        from apps.reverse_rooms.models import Room as _Room, RoomHost

        number_of_downloads = getattr(input, "number_of_downloads", None) or 10
        try:
            from apps.config.models import Config as _ConfigModel

            cfg = await _ConfigModel.get_config()
            number_of_downloads = getattr(cfg, "default_number_of_downloads", number_of_downloads) or number_of_downloads
        except Exception:
            pass

        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=max(1, input.expire_after))
        room = await _Room.objects.acreate(  # type: ignore[return-value]
            name=input.name, expire_after=input.expire_after, number_of_downloads=number_of_downloads, expires_at=expires_at)

        raw_token = str(_uuid.uuid4())
        host_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        await RoomHost.objects.acreate(room=room, host_token=host_hash)  # type: ignore[arg-type]

        return _types.RoomCreateResult(  # type: ignore[call-arg,name-defined]
            id=room.id, name=room.name, created_at=room.created_at, expires_at=expires_at,
            expire_after=input.expire_after, number_of_downloads=number_of_downloads,
            files=[], active_uploads_count=0, host_token=raw_token)

    @strawberry.mutation
    async def delete_room(self, info: strawberry.types.Info, id: strawberry.ID, host_token: str) -> bool:
        from apps.files.tasks import delete_file_storage_task
        from apps.reverse_rooms.models import Room as _Room, RoomFile as _RF, RoomHost

        try:
            room = await _Room.objects.aget(id=id)
        except Exception:
            return False

        host_hash = hashlib.sha256(host_token.encode("utf-8")).hexdigest()
        try:
            await RoomHost.objects.aget(room=room, host_token=host_hash)  # type: ignore[arg-type]
        except RoomHost.DoesNotExist:
            return False

        for key in [f async for f in _RF.objects.filter(room=room).avalues_list("key", flat=True)]:
            try:
                await delete_file_storage_task.aenqueue(str(key))
            except Exception:
                pass

        await room.adelete()
        return True

    @strawberry.mutation
    async def add_host(self, info: strawberry.types.Info, id: strawberry.ID, host_token: str) -> "HostTokenResult":  # type: ignore[name-defined]
        from apps.reverse_rooms.models import RoomHost

        await RoomHost.objects.acreate(room_id=id, host_token=hashlib.sha256(host_token.encode("utf-8")).hexdigest())  # type: ignore[arg-type]
        return _types.HostTokenResult(host_token=hashlib.sha256(host_token.encode("utf-8")).hexdigest())


@strawberry.type
class Mutation(ReverseRoomsMutations):
    pass
