import json
import logging

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from apps.files.reverse_models import Room, RoomFile
from apps.files.reverse_views import _serialize_room
from apps.files.services import get_storage

logger = logging.getLogger(__name__)

ROOM_GROUP_PREFIX = "reverse_room_"

CHUNK_SIZE = 64 * 1024  # 64KB chunks for WebSocket streaming


class ReverseRoomConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for reverse file sharing rooms.

    Hosts connect with ?host_token=... and can upload files.
    Guests connect without a token and receive files.
    File data is multiplexed over the WebSocket — binary chunks for file
    content, JSON frames for metadata.

    Works in single-process mode (in-memory channel layer) and behind a
    cluster (Redis channel layer) — all group messaging goes through the
    channel layer, which is backed by Redis in production.
    """

    role: str = "guest"
    room: Room | None = None
    host_token: str = ""

    async def connect(self):
        room_id = self.scope["url_route"]["kwargs"].get("room_id")
        if not room_id:
            await self.close(code=4001)
            return

        try:
            self.room = await Room.objects.aget(id=room_id)
        except Room.DoesNotExist:
            await self._send_json({"type": "error", "detail": "Room not found"})
            await self.close(code=4004)
            return

        if self.room.is_expired:
            await self._send_json({"type": "room_destroyed"})
            await self.close(code=4010)
            return

        group_name = f"{ROOM_GROUP_PREFIX}{room_id}"

        # Parse host token from query string
        query = self.scope.get("query_string", b"").decode()
        for param in query.split("&"):
            if param.startswith("host_token="):
                self.host_token = param.split("=", 1)[1]
                break

        # Validate host
        is_valid_host = False
        if self.host_token:
            is_valid_host = await sync_to_async(
                self.room.hosts.filter(host_token=self.host_token).exists
            )()
            if not is_valid_host:
                is_valid_host = self.room.host_token == self.host_token

        self.role = "host" if is_valid_host else "guest"

        await self.accept()
        await self.channel_layer.group_add(group_name, self.channel_name)

        # Send room snapshot
        files = await sync_to_async(list)(RoomFile.objects.filter(room=self.room))
        host_count = await sync_to_async(self.room.hosts.count)()
        snapshot = _serialize_room(self.room, files, host_count=host_count)
        await self._send_json({"type": "snapshot", "room": snapshot})

    async def disconnect(self, close_code):
        if self.room:
            group_name = f"{ROOM_GROUP_PREFIX}{self.room.id}"
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def receive(self, text_data):
        if not self.room:
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self._send_json({"type": "file_error", "detail": "Invalid JSON"})
            return

        msg_type = data.get("type")

        if msg_type in ("request_file", "download") and self.role == "guest":
            file_key = data.get("key")
            await self._stream_file(file_key)

    # --- Channel layer group message handlers ---

    async def file_added(self, event):
        await self._send_json({"type": "file_added", **event})

    async def file_start(self, event):
        await self._send_json({"type": "file_start", **event})

    async def file_end(self, event):
        await self._send_json({"type": "file_end", **event})

    async def file_error(self, event):
        await self._send_json({"type": "file_error", **event})

    async def file_removed(self, event):
        await self._send_json({"type": "file_removed", **event})

    async def room_destroyed(self, event):
        await self._send_json({"type": "room_destroyed"})

    async def snapshot(self, event):
        await self._send_json({"type": "snapshot", "room": event.get("room")})

    # --- Private helpers ---

    async def _stream_file(self, file_key: str):
        """Stream a file's content as binary WebSocket frames."""
        if not self.room:
            return

        try:
            room_file = await RoomFile.objects.filter(
                room=self.room, key=file_key
            ).afirst()
        except Exception:
            await self._send_json({
                "type": "file_error",
                "key": file_key,
                "detail": "File not found",
            })
            return

        if not room_file:
            await self._send_json({
                "type": "file_error",
                "key": file_key,
                "detail": "File not found",
            })
            return

        # Signal file start to all clients in the room
        group_name = f"{ROOM_GROUP_PREFIX}{self.room.id}"
        await self.channel_layer.group_send(group_name, {
            "type": "file_start",
            "key": room_file.key,
            "filename": room_file.filename,
            "size": room_file.size,
        })

        # Stream file chunks to the requester
        try:
            from apps.files.services import get_storage, LocalStorageBackend

            storage = get_storage()

            if isinstance(storage, LocalStorageBackend):
                # Local backend: read file in chunks and send
                file_path = storage.download_file_path(room_file.key)
                with open(file_path, "rb") as f:
                    while True:
                        chunk = f.read(CHUNK_SIZE)
                        if not chunk:
                            break
                        await self.send(chunk)
            else:
                # S3 backend: use async streaming
                body = await storage.download_stream(room_file.key)
                try:
                    while True:
                        chunk = await body.read(CHUNK_SIZE)
                        if not chunk:
                            break
                        await self.send(bytes(chunk))
                finally:
                    await body.close()

            # Signal file end
            await self.channel_layer.group_send(group_name, {
                "type": "file_end",
                "key": room_file.key,
                "filename": room_file.filename,
                "size": room_file.size,
            })
        except Exception as e:
            logger.error(f"Error streaming file {file_key}: {e}")
            await self.channel_layer.group_send(group_name, {
                "type": "file_error",
                "key": room_file.key,
                "detail": str(e),
            })

    async def _send_json(self, data: dict):
        """Send a JSON message over the WebSocket."""
        await self.send(json.dumps(data))
