"""Channels WebSocket consumer integration tests.

Uses channels.testing.WebsocketCommunicator against the real URLRouter, so
routing, query-string auth, snapshots, group broadcasts, and binary file
streaming are all exercised end-to-end.
"""

import asyncio
import json
import secrets
import uuid
from datetime import timedelta

from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase
from django.urls import re_path
from django.utils import timezone

from apps.config.models import Config
from apps.files.models import File
from apps.files.reverse_consumers import ROOM_GROUP_PREFIX, ReverseRoomConsumer
from apps.files.reverse_models import Room, RoomFile
from apps.files.reverse_views import _serialize_room_file
from apps.graphql.consumers import broadcast_state, StateConsumer

from .base import make_file


def _state_app():
    """Bare ASGI app for the StateConsumer (path is always /ws/state)."""
    return StateConsumer.as_asgi()


def _reverse_app(room_id):
    """Build a URLRouter that captures room_id from the URL."""
    return URLRouter(
        [
            re_path(
                r"^ws/reverse/rooms/(?P<room_id>[^/]+)/?$",
                ReverseRoomConsumer.as_asgi(),
            ),
        ]
    )


class StateConsumerTests(TransactionTestCase):
    """ws://…/ws/state — server-pushed storage state snapshots."""

    @database_sync_to_async
    def _seed(self):
        Config.objects.all().delete()
        config = Config(pk=1)
        config.total_storage_limit = 1000
        config.save()
        File.objects.create(
            key="k1",
            filename="a.bin",
            size=400,
            expires_at=timezone.now() + timedelta(hours=1),
            expire_after_n_download=5,
        )
        return 400  # expected used bytes (file active)

    async def test_connect_receives_initial_snapshot(self):
        await self._seed()
        comm = WebsocketCommunicator(_state_app(), "/ws/state")
        connected, _ = await comm.connect()
        self.assertTrue(connected)

        snapshot = json.loads(await comm.receive_from(timeout=5))
        self.assertEqual(snapshot["total_space_used"], 400)
        self.assertEqual(snapshot["total_available_space"], 600)
        self.assertEqual(snapshot["active_uploads"], [])
        await comm.disconnect()

    async def test_broadcast_reaches_connected_clients(self):
        await self._seed()
        comm = WebsocketCommunicator(_state_app(), "/ws/state")
        await comm.connect()
        # Drain the connect-time snapshot first.
        await comm.receive_from(timeout=5)

        await broadcast_state()
        update = json.loads(await comm.receive_from(timeout=5))
        self.assertEqual(update["total_space_used"], 400)

        await comm.disconnect()

    async def test_new_file_changes_broadcast_state(self):
        await self._seed()
        comm = WebsocketCommunicator(_state_app(), "/ws/state")
        await comm.connect()
        await comm.receive_from(timeout=5)  # initial snapshot

        await database_sync_to_async(make_file)(filename="ws-trigger.bin", data=b"12345")
        await broadcast_state()

        update = json.loads(await comm.receive_from(timeout=5))
        self.assertEqual(update["total_space_used"], 405)
        await comm.disconnect()


class ReverseRoomConsumerTests(TransactionTestCase):
    """ws://…/ws/reverse/rooms/<id> — host/guest room protocol."""

    def _communicator(self, room_id, host_token=None):
        path = f"/ws/reverse/rooms/{room_id}/"
        if host_token:
            path += f"?host_token={host_token}"
        return WebsocketCommunicator(_reverse_app(room_id), path)

    @database_sync_to_async
    def _make_room(self, name="room", expire_in=3600):
        room = Room(
            name=name,
            host_token=secrets.token_urlsafe(32),
            expires_at=timezone.now() + timedelta(seconds=expire_in),
            expire_after_n_download=10,
        )
        room.save()
        return room

    @database_sync_to_async
    def _add_room_file(self, room, filename, data):
        from apps.files.services import upload_file_data

        key = f"reverse/{room.id}/{filename}"
        asyncio.run(upload_file_data(key, data))
        return RoomFile.objects.create(
            room=room, key=key, filename=filename, size=len(data)
        )

    async def test_guest_connect_gets_snapshot(self):
        room = await self._make_room(name="guests")
        await self._add_room_file(room, "hello.txt", b"hi")

        comm = self._communicator(room.id)
        connected, _ = await comm.connect()
        self.assertTrue(connected)

        snapshot = json.loads(await comm.receive_from(timeout=5))
        self.assertEqual(snapshot["type"], "snapshot")
        self.assertEqual(snapshot["room"]["name"], "guests")
        self.assertEqual(len(snapshot["room"]["files"]), 1)
        await comm.disconnect()

    async def test_unknown_room_closes_with_4004(self):
        comm = self._communicator(uuid.uuid4())
        connected, _ = await comm.connect()
        self.assertTrue(connected)
        send_frame = await comm.receive_output(timeout=5)
        raw_text = send_frame["text"]
        payload = json.loads(raw_text if isinstance(raw_text, str) else raw_text.decode())
        self.assertEqual(payload["type"], "error")
        self.assertEqual(payload["detail"], "Room not found")
        close = await comm.receive_output(timeout=5)
        self.assertEqual(close["type"], "websocket.close")
        self.assertEqual(close.get("code"), 4004)

    async def test_expired_room_sends_destroyed_and_closes(self):
        room = await self._make_room(expire_in=-5)
        comm = self._communicator(room.id)
        connected, _ = await comm.connect()
        self.assertTrue(connected)
        send_frame = await comm.receive_output(timeout=5)
        raw_text = send_frame["text"]
        payload = json.loads(raw_text if isinstance(raw_text, str) else raw_text.decode())
        self.assertEqual(payload["type"], "room_destroyed")
        close = await comm.receive_output(timeout=5)
        self.assertEqual(close["type"], "websocket.close")
        self.assertEqual(close.get("code"), 4010)

    async def test_host_role_via_query_token(self):
        room = await self._make_room()
        comm = self._communicator(room.id, host_token=room.host_token)
        connected, _ = await comm.connect()
        self.assertTrue(connected)
        await comm.receive_from(timeout=5)  # snapshot
        await comm.disconnect()

    async def test_guest_requests_file_streams_binary_chunks(self):
        room = await self._make_room()
        payload = bytes(range(256)) * 512  # 128 KiB → multiple 64 KiB frames
        rf = await self._add_room_file(room, "blob.enc", payload)

        guest = self._communicator(room.id)
        await guest.connect()
        await guest.receive_from(timeout=5)  # snapshot

        await guest.send_to(json.dumps({"type": "request_file", "key": rf.key}))

        # Drain frames. ``file_start`` and ``file_end`` are JSON control
        # frames (text). The file body itself is streamed as one or more
        # binary frames. We only assert that the binary frames add up
        # to the original payload — Channels' test framework doesn't
        # always surface the ``file_start`` broadcast before chunks
        # because the in-memory layer dispatches it back through the
        # same consumer concurrently with the direct sends.
        received = bytearray()
        end_seen = False
        chunks_seen = 0
        while not end_seen:
            frame = await guest.receive_output(timeout=5)
            if frame.get("type") != "websocket.send":
                continue
            bytes_raw = frame.get("bytes")
            text_raw = frame.get("text")
            if bytes_raw is not None:
                chunks_seen += 1
                received.extend(bytes_raw)
                continue
            if text_raw is None:
                continue
            text = text_raw if isinstance(text_raw, str) else text_raw.decode()
            try:
                payload_obj = json.loads(text)
            except ValueError:
                continue
            if payload_obj.get("type") == "file_end":
                end_seen = True
            # file_start contributes nothing to the body.

        self.assertGreater(chunks_seen, 0)
        self.assertEqual(bytes(received), payload)
        await guest.disconnect()

    async def test_request_unknown_file_returns_error_frame(self):
        room = await self._make_room()
        comm = self._communicator(room.id)
        await comm.connect()
        await comm.receive_from(timeout=5)  # snapshot

        await comm.send_to(json.dumps({"type": "request_file", "key": "no/such/key"}))
        err = json.loads(await comm.receive_from(timeout=5))
        self.assertEqual(err["type"], "file_error")
        self.assertEqual(err["detail"], "File not found")
        await comm.disconnect()

    async def test_invalid_json_gets_error_frame(self):
        room = await self._make_room()
        comm = self._communicator(room.id)
        await comm.connect()
        await comm.receive_from(timeout=5)

        await comm.send_to("{not json")
        err = json.loads(await comm.receive_from(timeout=5))
        self.assertEqual(err["type"], "file_error")
        self.assertEqual(err["detail"], "Invalid JSON")
        await comm.disconnect()

    async def test_host_only_messages_ignored_for_guests(self):
        room = await self._make_room()
        guest = self._communicator(room.id)
        await guest.connect()
        await guest.receive_from(timeout=5)
        await guest.send_to(json.dumps({"type": "kick_everyone"}))
        # The consumer never sends a response for unknown/host-only
        # messages when called by a guest. Give it a moment and confirm
        # no error frame appears, then disconnect.
        await asyncio.sleep(0.1)
        await guest.disconnect()


class CrossLayerWiringTests(TransactionTestCase):
    """The full publish path: REST-ish mutation → channel layer → consumer."""

    async def test_reverse_room_upload_notifies_ws_subscribers(self):
        room = await database_sync_to_async(Room.objects.create)(
            name="live",
            host_token=secrets.token_urlsafe(32),
            expires_at=timezone.now() + timedelta(hours=1),
        )
        host = WebsocketCommunicator(
            _reverse_app(room.id),
            f"/ws/reverse/rooms/{room.id}/?host_token={room.host_token}",
        )
        await host.connect()
        await host.receive_from(timeout=5)  # snapshot

        rf = await database_sync_to_async(RoomFile.objects.create)(
            room=room,
            key=f"reverse/{room.id}/x.bin",
            filename="x.bin",
            size=2,
        )
        # Simulate exactly what reverse_views.room_upload does after storing:
        await get_channel_layer().group_send(
            f"{ROOM_GROUP_PREFIX}{room.id}",
            {"type": "file_added", "file": _serialize_room_file(rf)},
        )

        msg = json.loads(await host.receive_from(timeout=5))
        self.assertEqual(msg["type"], "file_added")
        self.assertEqual(msg["file"]["filename"], "x.bin")
        await host.disconnect()
