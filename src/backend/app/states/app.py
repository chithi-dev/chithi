from typing import Any

import redis.asyncio as redis
from pydantic import BaseModel
from redis.asyncio import Redis

from app.settings import settings

from ._global import GlobalState


class UploadProgress(GlobalState, BaseModel):
    upload_key: str
    filename: str
    uploaded_bytes: int = 0
    done: bool = False

    @classmethod
    async def start(cls, upload_key: str, filename: str) -> AppState:
        """Register a new in-flight upload."""
        current = await AppState.get()
        current.active_uploads.append(cls(upload_key=upload_key, filename=filename))
        await AppState.set(current)
        return current

    @classmethod
    async def update(cls, upload_key: str, uploaded_bytes: int) -> AppState:
        """Update the byte count for an in-flight upload."""
        current = await AppState.get()
        for upload in current.active_uploads:
            if upload.upload_key == upload_key:
                upload.uploaded_bytes = uploaded_bytes
                break
        await AppState.set(current)
        return current

    @classmethod
    async def finish(cls, upload_key: str, final_size: int) -> AppState:
        """Mark an upload as done and add its size to total_space_used."""
        current = await AppState.get()
        for upload in current.active_uploads:
            if upload.upload_key == upload_key:
                upload.done = True
                upload.uploaded_bytes = final_size
                break
        current.total_space_used += final_size
        await AppState.set(current)
        return current

    @classmethod
    async def cancel(cls, upload_key: str) -> AppState:
        """Remove a failed/disconnected upload from the active list."""
        current = await AppState.get()
        current.active_uploads = [
            u for u in current.active_uploads if u.upload_key != upload_key
        ]
        await AppState.set(current)
        return current


class AppState(GlobalState, BaseModel):
    total_space_used: int = 0
    total_available_space: int | None = None
    active_uploads: list[UploadProgress] = []

    @classmethod
    async def ensure_created(cls) -> None:
        """Ensure a state document exists in RedisJSON, syncing `total_available_space` from Config."""
        from sqlmodel import select

        from app.db import AsyncSessionLocal
        from app.models.config import Config

        async with AsyncSessionLocal() as session:
            result = await session.exec(select(Config))
            config = result.first()
            total_available_space = config.total_storage_limit if config else None

        existing = await cls._json_get(settings.STATE_REDIS_KEY)
        if existing is None:
            state = cls(total_available_space=total_available_space)
            await cls._json_set(settings.STATE_REDIS_KEY, state.model_dump(mode="json"))
        else:
            existing["total_available_space"] = total_available_space
            await cls._json_set(settings.STATE_REDIS_KEY, existing)

    @classmethod
    async def get(cls, redis_client: Redis | None = None) -> AppState:
        """Return the full current state from RedisJSON."""
        data = await cls._json_get(settings.STATE_REDIS_KEY, redis_client=redis_client)
        if data is None:
            return cls()
        return cls.model_validate(data)

    @classmethod
    async def set(cls, state: AppState, redis_client: Redis | None = None) -> None:
        """Overwrite the entire state and notify all app instances."""
        await cls._json_set(
            settings.STATE_REDIS_KEY,
            state.model_dump(mode="json"),
            redis_client=redis_client,
        )
        await cls._publish(
            settings.STATE_CHANNEL, state.model_dump_json(), redis_client=redis_client
        )

    @classmethod
    async def evict_files(
        cls, file_keys: list[str], freed_bytes: int, redis_client: Redis | None = None
    ) -> None:

        async def _evict(client: Redis) -> None:
            current = await cls.get(redis_client=client)
            key_set = set(file_keys)
            current.active_uploads = [
                u for u in current.active_uploads if u.upload_key not in key_set
            ]
            current.total_space_used = max(0, current.total_space_used - freed_bytes)
            await cls.set(current, redis_client=client)

        if redis_client is not None:
            await _evict(redis_client)
        else:
            async with redis.from_url(
                settings.REDIS_ENDPOINT, encoding="utf-8", decode_responses=True
            ) as client:
                await _evict(client)

    @classmethod
    async def patch(cls, **kwargs: Any) -> AppState:
        """Partially update the state, persist, and notify."""
        current = await cls.get()
        updated = current.model_copy(update=kwargs)
        updated = cls.model_validate(updated.model_dump())
        await cls.set(updated)
        return updated
