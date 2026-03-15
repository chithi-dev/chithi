import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from app.schemas.reverse import (
    AddHostOut,
    RoomCreateOut,
    RoomFileEntry,
    RoomFileEvent,
    RoomOut,
)
from app.states._global import GlobalState

# Lua script: atomically remove an element from a JSON array by matching
# a field value, and return the removed element (if any).
_LUA_REMOVE_FILE = """
local raw = redis.call('JSON.GET', KEYS[1], '$.files')
if not raw then return nil end
local outer = cjson.decode(raw)
local files = outer[1]
local removed = nil
local new_files = {}
for _, f in ipairs(files) do
    if f['key'] == ARGV[1] then
        removed = cjson.encode(f)
    else
        new_files[#new_files + 1] = f
    end
end
if removed then
    redis.call('JSON.SET', KEYS[1], '$.files', cjson.encode(new_files))
end
return removed
"""


def _room_key(room_id: str) -> str:
    return f"chithi:room:{room_id}"


def _room_channel(room_id: str) -> str:
    return f"chithi:room:{room_id}:events"


class RoomState(GlobalState):
    """Manage rooms stored in Redis."""

    @classmethod
    async def create(
        cls, name: str, expire_after: int, number_of_downloads: int
    ) -> RoomCreateOut:
        room_id = str(uuid.uuid7())
        now = datetime.now(timezone.utc)

        # Generate a cryptographically random host token; store its
        # SHA-256 hash in Redis so the plaintext is never persisted.
        host_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(host_token.encode()).hexdigest()

        # The Redis document includes host_token_hashes (internal) but
        # RoomOut (public) never exposes it.
        payload = {
            "id": room_id,
            "name": name,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(seconds=expire_after)).isoformat(),
            "files": [],
            "host_token_hashes": [token_hash],
            "number_of_downloads": number_of_downloads,
        }
        key = _room_key(room_id)
        await cls._json_set(key, payload)
        await cls._client().expire(key, expire_after)

        return RoomCreateOut(
            id=room_id,
            name=name,
            created_at=now,
            expires_at=now + timedelta(seconds=expire_after),
            files=[],
            host_token=host_token,
            number_of_downloads=number_of_downloads,
        )

    @classmethod
    async def get(cls, room_id: str, *, strip_keys: bool = True) -> RoomOut | None:
        """Retrieve a room.

        By default (`strip_keys=True`) the returned `RoomOut` will contain
        file entries whose `key` has the storage prefix removed so API
        consumers see only the short id. Internal callers that need the
        full storage key should pass `strip_keys=False`.
        """
        data = await cls._json_get(_room_key(room_id))
        if data is None:
            return None
        # Compute host_count from internal field before stripping it
        hashes = data.pop("host_token_hashes", [])
        data.pop("host_token_hash", None)  # compat with old format
        data["host_count"] = len(hashes) if isinstance(hashes, list) else 1
        # Ensure a default for number_of_downloads for backward compatibility
        if "number_of_downloads" not in data:
            data["number_of_downloads"] = None

        # Optionally remove the storage prefix from file keys for public
        # responses while leaving the stored document unchanged.
        if strip_keys and isinstance(data.get("files"), list):
            prefix = f"rooms/{room_id}/"
            new_files = []
            for f in data["files"]:
                if isinstance(f, dict) and isinstance(f.get("key"), str):
                    key = f["key"]
                    if key.startswith(prefix):
                        f = {**f, "key": key.removeprefix(prefix)}
                new_files.append(f)
            data["files"] = new_files

        return RoomOut.model_validate(data)

    @classmethod
    async def verify_host(cls, room_id: str, host_token: str) -> bool:
        """Return True if *host_token* matches any stored hash for this room."""
        data = await cls._json_get(_room_key(room_id))
        if data is None:
            return False
        provided_hash = hashlib.sha256(host_token.encode()).hexdigest()
        # Support new list format and legacy single-hash format
        hashes = data.get("host_token_hashes", [])
        if isinstance(hashes, list):
            return any(secrets.compare_digest(h, provided_hash) for h in hashes)
        stored_hash = data.get("host_token_hash", "")
        return secrets.compare_digest(stored_hash, provided_hash)

    @classmethod
    async def add_host(cls, room_id: str) -> AddHostOut | None:
        """Generate a new host token and append its hash to the room."""
        key = _room_key(room_id)
        data = await cls._json_get(key)
        if data is None:
            return None

        host_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(host_token.encode()).hexdigest()

        client = cls._client()
        try:
            await client.execute_command(
                "JSON.ARRAPPEND",
                key,
                "$.host_token_hashes",
                json.dumps(token_hash),
            )
        except Exception:
            return None

        # Broadcast host count change so all clients update
        hashes = data.get("host_token_hashes", [])
        new_count = (len(hashes) if isinstance(hashes, list) else 1) + 1
        await cls._publish(
            _room_channel(room_id),
            json.dumps({"type": "host_count", "count": new_count}),
        )

        return AddHostOut(host_token=host_token)

    @classmethod
    async def delete(cls, room_id: str) -> bool:
        result = await cls._client().delete(_room_key(room_id))
        return result > 0

    @classmethod
    async def add_file(cls, room_id: str, entry: RoomFileEntry) -> bool:
        """Atomically append a file entry to the room's files array.

        Uses ``JSON.ARRAPPEND`` so concurrent uploads from different FastAPI
        instances never clobber each other.

        Returns True on success, False if the room no longer exists.
        """
        key = _room_key(room_id)
        client = cls._client()
        try:
            await client.execute_command(
                "JSON.ARRAPPEND",
                key,
                "$.files",
                json.dumps(entry.model_dump(mode="json")),
            )
        except Exception:
            # Key doesn't exist (room expired) or path missing
            return False

        # Fan-out notification - every subscribed instance picks this up
        event = RoomFileEvent(event="file_added", file=entry)
        await cls._publish(_room_channel(room_id), event.model_dump_json())
        return True

    @classmethod
    async def remove_file(cls, room_id: str, file_key: str) -> RoomFileEntry | None:
        """Atomically remove a file by key using a Lua script.

        Returns the removed entry, or None if not found / room expired.
        """
        key = _room_key(room_id)
        client = cls._client()
        result = await client.eval(_LUA_REMOVE_FILE, 1, key, file_key)  # type: ignore[misc]
        if result is None:
            return None

        removed_entry = RoomFileEntry.model_validate_json(result)

        event = RoomFileEvent(event="file_removed", file=removed_entry)
        await cls._publish(_room_channel(room_id), event.model_dump_json())
        return removed_entry

    @classmethod
    def channel_for(cls, room_id: str) -> str:
        return _room_channel(room_id)

    @classmethod
    async def publish_event(cls, room_id: str, message: str) -> None:
        await cls._publish(_room_channel(room_id), message)
