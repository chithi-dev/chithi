"""WebSocket for reverse room real-time collaboration."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import uuid
from contextlib import suppress
from typing import Any

logger = logging.getLogger(__name__)

S3_CHUNK_SIZE = 256 * 1024  # 256 KB read chunks


def _key_in_seen(seen_keys: set[str], key: str, room_id: str) -> bool:
    if key in seen_keys:
        return True
    prefix = f"rooms/{room_id}/"
    candidate = key.removeprefix(prefix) if key.startswith(prefix) else prefix + key
    return candidate in seen_keys


async def _stream_file_to_ws(
    ws: Any,  # type: ignore[valid-type]
    entry: dict[str, Any],
    s3_client: Any,
    send_lock: asyncio.Lock,
    bucket_name: str,
) -> None:
    """Fetch one file from S3 and relay every chunk to *ws*."""
    try:
        s3_response = await s3_client.get_object(
            Bucket=bucket_name, Key=entry["key"],
        )
    except Exception:
        async with send_lock:
            await ws.send_text(json.dumps({  # type: ignore[attr-defined]
                "type": "file_error",
                "key": entry["key"],
                "detail": "Not found in storage",
            }))
        return

    async with send_lock:
        await ws.send_text(json.dumps({  # type: ignore[attr-defined]
            "type": "file_start",
            "key": entry["key"],
            "filename": entry.get("filename"),
            "size": entry.get("size"),
        }))

    body = s3_response["Body"]
    try:
        async for chunk in body.iter_chunks(S3_CHUNK_SIZE):
            async with send_lock:
                await ws.send_bytes(chunk)  # type: ignore[attr-defined]
    finally:
        body.close()

    async with send_lock:
        await ws.send_text(json.dumps({"type": "file_end", "key": entry["key"]}))  # type: ignore[attr-defined]


async def reverse_room_websocket_endpoint(
    ws: Any,  # type: ignore[valid-type]
    room_id: str,
    redis_url: str | None = None,
    s3_endpoint: str | None = None,
    bucket_name: str | None = None,
    host_token_query: str | None = None,
) -> None:
    """ASGI WebSocket endpoint for /ws/reverse/rooms/{room_id}."""
    import aioboto3  # type: ignore[import-untyped,unused-ignore]

    redis_url = redis_url or "redis://localhost:6379/1"
    bucket_name = bucket_name or "chithi"

    # Verify room exists
    room_key = f"chithi:room:{room_id}"
    client = aioboto3.Session()  # type: ignore[attr-defined]
    async with client.client("s3", endpoint_url=s3_endpoint or "http://localhost:9000") as s3:
        room_data_raw = None

    # Use Redis to check room
    _r_mod = __import__("redis.asyncio")  # type: ignore[misc]
    r = _r_mod
    redis_client = r.from_url(redis_url)

    # Check room exists in Redis (using JSON)
    try:
        result = await redis_client.execute_command(  # type: ignore[attr-defined]
            "JSON.GET", room_key, "$"
        )
        if result is None or result == b"null":
            room_data_raw = None
        else:
            room_data_raw = json.loads(result[0]) if isinstance(result[0], bytes) else json.loads(result[0].decode()) if isinstance(result[0], (bytes, bytearray)) else result[0]
    except Exception:
        room_data_raw = None

    if not room_data_raw:
        await ws.close(code=4004, reason="Room not found or expired")  # type: ignore[attr-defined]
        return

    is_host = False
    if host_token_query:
        token_hash = hashlib.sha256(host_token_query.encode()).hexdigest()
        hashes = room_data_raw.get("host_token_hashes", [])
        if isinstance(hashes, list):
            is_host = any(secrets_compare_digest(h, token_hash) for h in hashes)  # type: ignore[name-defined]
        else:
            is_host = secrets_compare_digest(str(room_data_raw.get("host_token_hash", "")), token_hash)  # type: ignore[name-defined]

        if not is_host:
            await ws.close(code=4003, reason="Invalid host token")  # type: ignore[attr-defined]
            return

    await ws.accept()  # type: ignore[attr-defined]
    client_id = str(uuid.uuid4())

    # Track online clients in Redis sets
    hosts_set = f"chithi:room:{room_id}:hosts:online"
    guests_set = f"chithi:room:{room_id}:guests:online"
    target_set = hosts_set if is_host else guests_set
    await redis_client.sadd(target_set, client_id)  # type: ignore[attr-defined]
    await redis_client.expire(target_set, 3600)  # type: ignore[attr-defined]

    # Subscribe to room channel
    pubsub = redis_client.pubsub()
    channel = f"chithi:room:{room_id}:events"
    await pubsub.subscribe(channel)

    # Refresh room data (snapshot)
    try:
        result = await redis_client.execute_command("JSON.GET", room_key, "$")  # type: ignore[attr-defined]
        current_room = json.loads(result[0]) if result and result[0] not in (b"null", None) else None
    except Exception:
        current_room = None

    if not current_room:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()  # type: ignore[attr-defined]
        return

    # Send snapshot with stripped keys
    snapshot = dict(current_room)
    files = snapshot.get("files", [])
    prefix = f"rooms/{room_id}/"
    for f in files:
        if isinstance(f, dict) and isinstance(f.get("key"), str) and f["key"].startswith(prefix):
            f["key"] = f["key"].removeprefix(prefix)

    await ws.send_text(json.dumps({"type": "snapshot", "room": snapshot}))  # type: ignore[attr-defined]

    send_lock = asyncio.Lock()
    seen_keys = {e.get("key") for e in files if isinstance(e, dict)}
    done_event = asyncio.Event()

    async def _dispatch_file(entry: dict[str, Any]) -> None:
        try:
            await _stream_file_to_ws(ws, entry, s3, send_lock, bucket_name)  # type: ignore[name-defined]
        except Exception:
            logger.exception("Failed to stream file %s", entry.get("key"))

    async def _listen_and_stream() -> None:
        async with asyncio.TaskGroup() as tg:
            for entry in files:
                if isinstance(entry, dict):
                    tg.create_task(_dispatch_file(dict(entry)))

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
                        await ws.send_text(json.dumps({"type": "room_destroyed"}))  # type: ignore[attr-defined]
                    await ws.close(code=4001, reason="Room destroyed by host")  # type: ignore[attr-defined]
                    done_event.set()
                    return

                if msg_type in ("host_count", "connection_counts"):
                    async with send_lock:
                        await ws.send_text(json.dumps(data))  # type: ignore[attr-defined]
                    continue

                if msg_type in ("upload_start", "upload_progress", "upload_cancelled"):
                    async with send_lock:
                        await ws.send_text(json.dumps(data))  # type: ignore[attr-defined]
                    continue

                event_event = data.get("event")
                if event_event == "file_added":
                    file_entry = data.get("file", {})
                    public_file = dict(file_entry)
                    pk = public_file.get("key", "")
                    if isinstance(pk, str) and pk.startswith(prefix):
                        public_file["key"] = pk.removeprefix(prefix)

                    async with send_lock:
                        await ws.send_text(json.dumps({"type": "file_added", "file": public_file}))  # type: ignore[attr-defined]

                    if _key_in_seen(seen_keys, file_entry.get("key", ""), room_id):
                        continue
                    seen_keys.add(file_entry.get("key", ""))
                    tg.create_task(_dispatch_file(dict(file_entry)))

                elif event_event == "file_removed":
                    pub_key = data["file"].get("key", "") if isinstance(data.get("file"), dict) else ""
                    if isinstance(pub_key, str) and pub_key.startswith(prefix):
                        pub_key = pub_key.removeprefix(prefix)

                    async with send_lock:
                        await ws.send_text(json.dumps({  # type: ignore[attr-defined]
                            "type": "file_removed",
                            "key": pub_key,
                            "filename": data["file"].get("filename") if isinstance(data.get("file"), dict) else "",
                        }))

    listen_task = asyncio.create_task(_listen_and_stream())

    # Keepalive
    async def _keepalive() -> None:
        while not done_event.is_set():
            await asyncio.sleep(15)
            try:
                await ws.send_ping(b"")  # type: ignore[attr-defined]
            except Exception:
                break

    keepalive_task = asyncio.create_task(_keepalive())

    try:
        while True:
            message = await ws.receive_text()  # type: ignore[attr-defined]
            try:
                data = json.loads(message)
                if data.get("type") == "request_file":
                    file_key = data.get("key")
                    if not file_key:
                        continue

                    current = None
                    try:
                        result2 = await redis_client.execute_command("JSON.GET", room_key, "$")  # type: ignore[attr-defined]
                        current = json.loads(result2[0]) if result2 and result2[0] not in (b"null", None) else None
                    except Exception:
                        pass

                    if current:
                        entry_match = next(
                            (f for f in current.get("files", []) if isinstance(f, dict) and f.get("key") == file_key),
                            None,
                        ) or next(
                            (f for f in current.get("files", []) if isinstance(f, dict) and f.get("key") == prefix + file_key),
                            None,
                        )
                        if entry_match:
                            asyncio.create_task(_dispatch_file(dict(entry_match)))  # type: ignore[misc]
                        else:
                            async with send_lock:
                                await ws.send_text(json.dumps({  # type: ignore[attr-defined]
                                    "type": "file_error",
                                    "key": file_key,
                                    "detail": "File not found in room",
                                }))
            except json.JSONDecodeError:
                continue
    finally:
        try:
            await redis_client.srem(hosts_set if is_host else guests_set, client_id)  # type: ignore[attr-defined]
        except Exception:
            pass
        done_event.set()
        listen_task.cancel()
        keepalive_task.cancel()
        with suppress(asyncio.CancelledError):
            await listen_task
        with suppress(asyncio.CancelledError):
            await keepalive_task
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()  # type: ignore[attr-defined]


def secrets_compare_digest(a: str, b: str) -> bool:
    """Compare two strings in constant time."""
    return hashlib.compare_digest(a.encode(), b.encode())
