from datetime import datetime, timezone

import redis.asyncio as redis
from pydantic import BaseModel
from redis.asyncio import Redis

from app.settings import settings

from ._global import GlobalState


class UploadProgress(BaseModel):
    upload_key: str
    filename: str
    uploaded_bytes: int = 0
    done: bool = False
    last_updated: datetime | None = None
    track_space: bool = True

    @classmethod
    async def start(cls, upload_key: str, filename: str, track_space: bool = True):
        return await AppState._update_active(
            upload_key, filename=filename, track_space=track_space
        )

    @classmethod
    async def update(cls, upload_key: str, uploaded_bytes: int):
        return await AppState._update_active(upload_key, uploaded_bytes=uploaded_bytes)

    @classmethod
    async def finish(cls, upload_key: str, final_size: int):
        return await AppState._update_active(
            upload_key, uploaded_bytes=final_size, done=True
        )

    @classmethod
    async def cancel(cls, upload_key: str):
        return await AppState._update_active(upload_key, remove=True)


class AppState(GlobalState, BaseModel):
    total_space_used: int = 0
    total_available_space: int | None = None
    active_uploads: list[UploadProgress] = []

    @classmethod
    async def get(cls, redis_client: Redis | None = None) -> "AppState":
        data = await cls._json_get(settings.STATE_REDIS_KEY, redis_client=redis_client)
        return cls.model_validate(data) if data else cls()

    @classmethod
    async def set(cls, state: "AppState", redis_client: Redis | None = None) -> None:
        await cls._json_set(
            settings.STATE_REDIS_KEY,
            state.model_dump(mode="json"),
            redis_client=redis_client,
        )
        await cls._publish(
            settings.STATE_CHANNEL, state.model_dump_json(), redis_client=redis_client
        )

    @classmethod
    async def _update_active(cls, key: str, remove=False, **kwargs) -> "AppState":
        """Unified internal method for all upload state changes (start, update, finish, cancel)."""
        s = await cls.get()
        now = datetime.now(timezone.utc)
        upload = next((u for u in s.active_uploads if u.upload_key == key), None)

        # Update Space Tracking (if track_space is True)
        if upload and upload.track_space:
            if remove:
                s.total_space_used = max(0, s.total_space_used - upload.uploaded_bytes)
            elif "uploaded_bytes" in kwargs:
                s.total_space_used += kwargs["uploaded_bytes"] - upload.uploaded_bytes

        # Update Active Uploads List
        if remove or (upload and kwargs.get("done") and not upload.track_space):
            s.active_uploads = [u for u in s.active_uploads if u.upload_key != key]
        elif not upload:
            s.active_uploads.append(
                UploadProgress(upload_key=key, last_updated=now, **kwargs)
            )
        else:
            for k, v in kwargs.items():
                setattr(upload, k, v)
            upload.last_updated = now

        await cls.set(s)
        return s

    @classmethod
    async def evict_files(
        cls, file_keys: list[str], freed_bytes: int, redis_client: Redis | None = None
    ) -> None:
        async def _evict(client: Redis):
            s = await cls.get(redis_client=client)
            keys = set(file_keys)
            s.active_uploads = [u for u in s.active_uploads if u.upload_key not in keys]
            s.total_space_used = max(0, s.total_space_used - freed_bytes)
            await cls.set(s, redis_client=client)

        if redis_client:
            await _evict(redis_client)
        else:
            async with redis.from_url(
                settings.REDIS_ENDPOINT, encoding="utf-8", decode_responses=True
            ) as client:
                await _evict(client)

    @classmethod
    async def ensure_created(cls) -> None:
        from sqlmodel import select

        from app.db import AsyncSessionLocal
        from app.models.config import Config

        async with AsyncSessionLocal() as session:
            config = (await session.exec(select(Config))).first()
            limit = config.total_storage_limit if config else None

        s = await cls.get()
        s.total_available_space = limit
        await cls.set(s)
