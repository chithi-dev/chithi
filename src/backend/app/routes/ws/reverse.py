import asyncio
import json
import logging
from contextlib import suppress

import aioboto3
import redis.asyncio as aioredis
from botocore.exceptions import ClientError
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.schemas.reverse import RoomFileEntry, RoomFileEvent
from app.settings import settings
from app.states.room import RoomState

logger = logging.getLogger(__name__)

router = APIRouter()


async def _stream_file_to_ws(ws: WebSocket, entry: RoomFileEntry) -> None:
    """Fetch a file from RustFS and relay every chunk to *ws*.

    Mirrors the streaming pattern in ``download.py`` - the client receives raw
    bytes without ever knowing about the backing S3 store.
    """
    session = aioboto3.Session()
    async with session.client(
        "s3",
        endpoint_url=settings.RUSTFS_ENDPOINT_URL,
        aws_access_key_id=settings.RUSTFS_ACCESS_KEY,
        aws_secret_access_key=settings.RUSTFS_SECRET_ACCESS_KEY,
    ) as s3:
        try:
            s3_response = await s3.get_object(
                Bucket=settings.RUSTFS_BUCKET_NAME, Key=entry.key
            )
        except ClientError:
            await ws.send_text(
                json.dumps(
                    {
                        "type": "file_error",
                        "key": entry.key,
                        "detail": "Not found in storage",
                    }
                )
            )
            return

        #  tells the client which file is coming and how large it is
        await ws.send_text(
            json.dumps(
                {
                    "type": "file_start",
                    "key": entry.key,
                    "filename": entry.filename,
                    "size": entry.size,
                }
            )
        )

        # Binary chunks
        try:
            async for chunk in s3_response["Body"]:
                await ws.send_bytes(chunk)
        finally:
            s3_response["Body"].close()

        # signals the client that this file is complete
        await ws.send_text(json.dumps({"type": "file_end", "key": entry.key}))


@router.websocket("/ws/reverse/rooms/{room_id}")
async def room_ws(ws: WebSocket, room_id: str, host_token: str | None = None):
    # Quick existence check before accepting the connection
    room = await RoomState.get(room_id)
    if room is None:
        await ws.close(code=4004, reason="Room not found or expired")
        return

    # Determine if this connection is the host
    is_host = False
    if host_token is not None:
        is_host = await RoomState.verify_host(room_id, host_token)
        if not is_host:
            await ws.close(code=4003, reason="Invalid host token")
            return

    await ws.accept()

    # subscribe FIRST so no events are lost between snapshot and listen
    sub_client = aioredis.from_url(
        settings.REDIS_ENDPOINT, encoding="utf-8", decode_responses=True
    )
    pubsub = sub_client.pubsub()
    channel = RoomState.channel_for(room_id)
    await pubsub.subscribe(channel)

    # snapshot (re-read after subscribe to guarantee consistency)
    room = await RoomState.get(room_id)
    if room is None:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await sub_client.aclose()
        await ws.close(code=4004, reason="Room expired")
        return

    await ws.send_text(
        json.dumps({"type": "snapshot", "room": room.model_dump(mode="json")})
    )

    # Queue that serialises all file streams (catch-up + real-time).
    # Existing files from the snapshot are enqueued first; new events
    # arriving through pub/sub are appended in order.
    file_queue: asyncio.Queue[RoomFileEntry | None] = asyncio.Queue()
    seen_keys: set[str] = set()

    # Enqueue existing files so late clients get them streamed
    for entry in room.files:
        seen_keys.add(entry.key)
        file_queue.put_nowait(entry)

    async def _listen_events() -> None:
        """Read room events from Redis pub/sub and either queue file
        streams or forward lightweight notifications.

        Events for files already in the snapshot are deduplicated via
        ``seen_keys`` so late clients don't receive the same file twice.
        """
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue

                raw = message["data"]
                try:
                    data = json.loads(raw)
                except Exception:
                    continue

                # Host destroyed the room - notify client and close
                if data.get("type") == "room_destroyed":
                    await ws.send_text(json.dumps({"type": "room_destroyed"}))
                    file_queue.put_nowait(None)
                    await ws.close(code=4001, reason="Room destroyed by host")
                    return

                # Host count changed - forward directly
                if data.get("type") == "host_count":
                    await ws.send_text(json.dumps(data))
                    continue

                try:
                    event = RoomFileEvent.model_validate(data)
                except Exception:
                    logger.exception("Bad event on room channel %s", room_id)
                    continue

                if event.event == "file_added":
                    if event.file.key in seen_keys:
                        # Already queued from the snapshot - skip duplicate
                        continue
                    seen_keys.add(event.file.key)
                    file_queue.put_nowait(event.file)
                elif event.event == "file_removed":
                    await ws.send_text(
                        json.dumps(
                            {
                                "type": "file_removed",
                                "key": event.file.key,
                                "filename": event.file.filename,
                            }
                        )
                    )
        except WebSocketDisconnect, asyncio.CancelledError:
            pass

    # pulls from queue and streams one file at a time
    async def _stream_queued_files() -> None:
        try:
            while True:
                entry = await file_queue.get()
                if entry is None:
                    break
                await _stream_file_to_ws(ws, entry)
        except WebSocketDisconnect, asyncio.CancelledError:
            pass

    listen_task = asyncio.create_task(_listen_events())
    stream_task = asyncio.create_task(_stream_queued_files())

    try:
        # Keep alive - read (and discard) client pings / messages
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        listen_task.cancel()
        file_queue.put_nowait(None)  # unblock streamer
        stream_task.cancel()
        with suppress(asyncio.CancelledError):
            await listen_task
        with suppress(asyncio.CancelledError):
            await stream_task
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await sub_client.aclose()
