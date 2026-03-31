import asyncio
import json
import logging
import uuid
from contextlib import suppress
from typing import Annotated, Final

from botocore.exceptions import ClientError
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.converter.bytes import ByteSize
from app.deps import RedisDep, S3Dep
from app.schemas.reverse import RoomFileEntry, RoomFileEvent
from app.settings import settings
from app.states.app import UploadProgress
from app.states.room import RoomState

logger = logging.getLogger(__name__)
router = APIRouter()

S3_CHUNK_SIZE: Final[int] = ByteSize(kb=256).total_bytes()  # 256 KB read chunks

s3_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_S3_READS)


async def _stream_file_to_ws(
    ws: WebSocket,
    entry: RoomFileEntry,
    s3_client,
    send_lock: asyncio.Lock,
) -> None:
    """Fetch one file from RustFS and relay every chunk to *ws*."""
    upload_key = f"ws:{uuid.uuid4()}"
    await UploadProgress.start(
        upload_key=upload_key, filename=entry.filename, track_space=False
    )

    success = False
    try:
        try:
            s3_response = await s3_client.get_object(
                Bucket=settings.RUSTFS_BUCKET_NAME,
                Key=entry.key,
            )
        except ClientError:
            async with send_lock:
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

        async with send_lock:
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

        body = s3_response["Body"]
        uploaded_bytes = 0
        try:
            async for chunk in body.iter_chunks(S3_CHUNK_SIZE):
                async with send_lock:
                    await ws.send_bytes(chunk)
                uploaded_bytes += len(chunk)
                await UploadProgress.update(
                    upload_key=upload_key, uploaded_bytes=uploaded_bytes
                )
        finally:
            body.close()

        async with send_lock:
            await ws.send_text(json.dumps({"type": "file_end", "key": entry.key}))

        await UploadProgress.finish(upload_key=upload_key, final_size=entry.size)
        success = True
    except asyncio.CancelledError, Exception:
        raise
    finally:
        if not success:
            await UploadProgress.cancel(upload_key=upload_key)


@router.websocket("/ws/reverse/rooms/{room_id}")
async def room_ws(
    ws: WebSocket,
    s3_client: S3Dep,
    redis_client: RedisDep,
    room_id: str,
    host_token: Annotated[str | None, Query()] = None,
):
    room = await RoomState.get(room_id, strip_keys=False)
    if room is None:
        await ws.close(code=4004, reason="Room not found or expired")
        return

    is_host = False
    if host_token is not None:
        is_host = await RoomState.verify_host(room_id, host_token)
        if not is_host:
            await ws.close(code=4003, reason="Invalid host token")
            return

    await ws.accept()

    client_id = str(uuid.uuid4())
    await RoomState.client_online(room_id, client_id, is_host)

    pubsub = redis_client.pubsub()
    channel = RoomState.channel_for(room_id)
    await pubsub.subscribe(channel)

    room = await RoomState.get(room_id, strip_keys=False)
    if room is None:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await RoomState.client_offline(room_id, client_id, is_host)
        await ws.close(code=4004, reason="Room expired")
        return

    # Send a public snapshot with stripped file keys
    snapshot = room.model_dump(mode="json")
    if isinstance(snapshot.get("files"), list):
        prefix = f"rooms/{room_id}/"
        for f in snapshot["files"]:
            if isinstance(f, dict) and isinstance(f.get("key"), str):
                k = f["key"]
                if k.startswith(prefix):
                    f["key"] = k.removeprefix(prefix)

    await ws.send_text(json.dumps({"type": "snapshot", "room": snapshot}))

    send_lock = asyncio.Lock()
    done_event = asyncio.Event()

    async def _dispatch_file(entry: RoomFileEntry) -> None:
        async with s3_semaphore:
            await _stream_file_to_ws(ws, entry, s3_client, send_lock)

    async def _listen_and_stream() -> None:
        seen_keys: set[str] = {e.key for e in room.files}

        async with asyncio.TaskGroup() as tg:
            # catch-up: files already in the snapshot
            for entry in room.files:
                tg.create_task(_dispatch_file(entry))

            # real-time: events arriving while connected
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue

                try:
                    data = json.loads(message["data"])
                except Exception:
                    continue

                msg_type = data.get("type")

                if msg_type == "room_destroyed":
                    async with send_lock:
                        await ws.send_text(json.dumps({"type": "room_destroyed"}))
                    await ws.close(code=4001, reason="Room destroyed by host")
                    done_event.set()
                    return

                if msg_type in ("host_count", "connection_counts"):
                    async with send_lock:
                        await ws.send_text(json.dumps(data))
                    continue

                if msg_type in ("upload_start", "upload_progress", "upload_cancelled"):
                    async with send_lock:
                        await ws.send_text(json.dumps(data))
                    continue

                try:
                    event = RoomFileEvent.model_validate(data)
                except Exception:
                    logger.exception("Bad event on room channel %s", room_id)
                    continue

                if event.event == "file_added":
                    # Notify frontend about the new file entry
                    public_file = event.file.model_dump(mode="json")
                    # strip key for public consumers
                    if isinstance(public_file.get("key"), str):
                        pk = public_file["key"]
                        prefix = f"rooms/{room_id}/"
                        if pk.startswith(prefix):
                            public_file["key"] = pk.removeprefix(prefix)

                    async with send_lock:
                        await ws.send_text(
                            json.dumps({"type": "file_added", "file": public_file})
                        )

                    if event.file.key in seen_keys:
                        continue
                    seen_keys.add(event.file.key)
                    tg.create_task(_dispatch_file(event.file))

                elif event.event == "file_removed":
                    # send public key to clients
                    public_key = event.file.key
                    prefix = f"rooms/{room_id}/"
                    if isinstance(public_key, str) and public_key.startswith(prefix):
                        public_key = public_key.removeprefix(prefix)

                    async with send_lock:
                        await ws.send_text(
                            json.dumps(
                                {
                                    "type": "file_removed",
                                    "key": public_key,
                                    "filename": event.file.filename,
                                }
                            )
                        )

    listen_task = asyncio.create_task(_listen_and_stream())

    try:
        while True:
            message = await ws.receive_text()
            try:
                data = json.loads(message)
                if data.get("type") == "request_file":
                    file_key = data.get("key")
                    if not file_key:
                        continue

                    # Search in existing files
                    # Note: room.files might be slightly stale but _listen_and_stream
                    # updates seen_keys. For a request_file, we should check the latest.
                    current_room = await RoomState.get(room_id, strip_keys=False)
                    if not current_room:
                        continue

                    entry = next(
                        (f for f in current_room.files if f.key == file_key), None
                    )
                    if not entry:
                        # Try with prefix if the client sent a stripped key
                        prefix = f"rooms/{room_id}/"
                        entry = next(
                            (
                                f
                                for f in current_room.files
                                if f.key == prefix + file_key
                            ),
                            None,
                        )

                    if entry:
                        # Stream the file in the background (respecting semaphore)
                        asyncio.create_task(_dispatch_file(entry))
                    else:
                        async with send_lock:
                            await ws.send_text(
                                json.dumps(
                                    {
                                        "type": "file_error",
                                        "key": file_key,
                                        "detail": "File not found in room",
                                    }
                                )
                            )
            except json.JSONDecodeError:
                continue
    except WebSocketDisconnect:
        pass
    finally:
        await RoomState.client_offline(room_id, client_id, is_host)
        listen_task.cancel()
        done_event.set()
        with suppress(asyncio.CancelledError, ExceptionGroup):
            await listen_task

        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
