"""Stateless WebSocket relay for reverse-share rooms.

The backend stores no room data and no file bytes. It only joins sockets
into a Channels group keyed by ``room_id`` and forwards messages between
members. The host is responsible for room lifecycle and file storage.

Protocol (JSON frames unless noted):

**Client -> Server**
- ``{"type": "request_file", "key": "<file_key>"}``
  Ask the server to stream a file's bytes. The server responds with a
  ``file_start`` message, then raw binary frames, then a ``file_end`` message.
- Any other JSON message is forwarded verbatim to all other group members.

**Server -> Client**
- ``{"type": "connection_counts", "hosts": N, "guests": N}``
  Sent to all group members whenever a socket joins or leaves.
- ``{"type": "file_start", "key", "filename", "size"}``
- Raw binary frames (the encrypted file bytes)
- ``{"type": "file_end", "key", "filename", "size"}``
- ``{"type": "file_error", "detail", "key"}``
- All other JSON messages forwarded from other group members.
"""

import json
import logging

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.reverse import _connection_counters as cc
from apps.reverse.relay import group_name, stream_file

logger = logging.getLogger(__name__)

BINARY_READ_SIZE = 1024 * 1024  # 1 MB per binary frame


class RoomConsumer(AsyncJsonWebsocketConsumer):
    """Relay a single WebSocket connection to/from its room group."""

    async def connect(self) -> None:
        self.room_id: str = self.scope["url_route"]["kwargs"]["room_id"]
        self.is_host = b"host_token" in self.scope.get("query_string", b"")

        await self.accept()
        await self.channel_layer.group_add(group_name(self.room_id), self.channel_name)

        kind = "hosts" if self.is_host else "guests"
        await sync_to_async(cc.increment)(self.room_id, kind)
        await self._broadcast_counts()

        logger.debug(
            "WS connected: room=%s role=%s",
            self.room_id,
            "host" if self.is_host else "guest",
        )

    async def disconnect(self, close_code: int) -> None:
        if not hasattr(self, "room_id"):
            return
        await self.channel_layer.group_discard(
            group_name(self.room_id), self.channel_name
        )
        kind = "hosts" if getattr(self, "is_host", False) else "guests"
        await sync_to_async(cc.decrement)(self.room_id, kind)
        await self._broadcast_counts()

    # ------------------------------------------------------------------
    # Inbound JSON from the client
    # ------------------------------------------------------------------

    async def receive(self, text_data: str | None = None, bytes_data: bytes | None = None, **kwargs) -> None:
        # AsyncJsonWebsocketConsumer passes the decoded JSON as text_data.
        if text_data is None:
            return
        content = json.loads(text_data)
        msg_type = content.get("type")

        if msg_type == "request_file":
            await self._handle_request_file(content)
            return

        # Everything else is relayed to the other group members.
        await self._broadcast_to_others(content)

    # ------------------------------------------------------------------
    # Group-broadcast handler (messages forwarded from other members)
    # ------------------------------------------------------------------

    async def room_message(self, event: dict) -> None:
        # Skip messages we sent ourselves (the relay tags them with the
        # sender's channel name so the sender can filter them out).
        if event.get("sender") == self.channel_name:
            return
        await self.send_json(event["payload"])

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _broadcast_counts(self) -> None:
        hosts, guests = await sync_to_async(self._read_counts)()
        # Connection counts are a system message, not a relay -- send to all
        # members including self.
        await self.channel_layer.group_send(
            group_name(self.room_id),
            {"type": "room_message", "payload": {"type": "connection_counts", "hosts": hosts, "guests": guests}},
        )

    def _read_counts(self) -> tuple[int, int]:
        return cc.get(self.room_id, "hosts"), cc.get(self.room_id, "guests")

    async def _broadcast_to_others(self, message: dict) -> None:
        """Relay *message* to all group members except the sender.

        The sender's channel name is tagged on the event so each consumer
        can skip its own copy in ``room_message``.
        """
        await self.channel_layer.group_send(
            group_name(self.room_id),
            {"type": "room_message", "payload": message, "sender": self.channel_name},
        )

    async def _handle_request_file(self, content: dict) -> None:
        """Stream a file's encrypted bytes to the requesting client."""
        file_key = content.get("key", "")
        if not file_key:
            await self.send_json({"type": "file_error", "detail": "Missing file key", "key": ""})
            return

        await self.send_json(
            {
                "type": "file_start",
                "key": file_key,
                "filename": content.get("filename", ""),
                "size": content.get("size", 0),
            }
        )

        try:
            stream = stream_file(file_key, 0, BINARY_READ_SIZE)
            async for block in stream:
                if block:
                    await self.send(bytes=block)
        except Exception as e:
            logger.error("Stream error for %s: %s", file_key, e)
            await self.send_json({"type": "file_error", "detail": str(e), "key": file_key})
            return

        await self.send_json(
            {
                "type": "file_end",
                "key": file_key,
                "filename": content.get("filename", ""),
                "size": content.get("size", 0),
            }
        )
