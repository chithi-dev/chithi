from datetime import datetime, timezone
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
    last_updated: datetime | None = None
    track_space: bool = True

    @classmethod
    async def start(
        cls, upload_key: str, filename: str, track_space: bool = True
    ) -> AppState:
        """Register a new in-flight upload and set last_updated."""
        current = await AppState.get()
        now = datetime.now(timezone.utc)
        current.active_uploads.append(
            cls(
                upload_key=upload_key,
                filename=filename,
                last_updated=now,
                track_space=track_space,
            )
        )
        await AppState.set(current)
        return current

    @classmethod
    async def update(cls, upload_key: str, uploaded_bytes: int) -> AppState:
        """Update the byte count and touch last_updated for an in-flight upload."""
        current = await AppState.get()
        now = datetime.now(timezone.utc)
        for upload in current.active_uploads:
            if upload.upload_key == upload_key:
                if upload.track_space:
                    # Add the delta to total_space_used so partial uploads are accounted
                    delta = uploaded_bytes - (upload.uploaded_bytes or 0)
                    if delta > 0:
                        current.total_space_used += delta
                upload.uploaded_bytes = uploaded_bytes
                upload.last_updated = now
                break
        await AppState.set(current)
        return current

    @classmethod
    async def finish(cls, upload_key: str, final_size: int) -> "AppState":
        """Mark an upload as done, touch last_updated, and add its size to total_space_used."""
        current = await AppState.get()
        now = datetime.now(timezone.utc)
        for upload in current.active_uploads:
            if upload.upload_key == upload_key:
                if upload.track_space:
                    # If we tracked partial bytes earlier, only add the remaining delta
                    delta = final_size - (upload.uploaded_bytes or 0)
                    if delta > 0:
                        current.total_space_used += delta
                upload.done = True
                upload.uploaded_bytes = final_size
                upload.last_updated = now
                break
        await AppState.set(current)
        return current

    @classmethod
    async def cancel(cls, upload_key: str) -> AppState:
        """Remove a failed/disconnected upload from the active list without adjusting totals."""
        current = await AppState.get()
        # Subtract any tracked uploaded bytes from totals when cancelling
        remaining = []
        freed = 0
        for u in current.active_uploads:
            if u.upload_key == upload_key:
                if u.track_space:
                    freed += u.uploaded_bytes or 0
            else:
                remaining.append(u)
        current.active_uploads = remaining
        if freed > 0:
            current.total_space_used = max(0, current.total_space_used - freed)
        await AppState.set(current)
        return current


class AppState(GlobalState, BaseModel):
    total_space_used: int = 0
    total_available_space: int | None = None
    active_uploads: list[UploadProgress] = []

    @classmethod
    async def state_sync(cls) -> None:
        """Ensure a state document exists in RedisJSON, sync `total_available_space` from
        Config, reconcile DB `File` rows with the backend storage (RustFS/S3), and
        remove orphan objects or DB rows. Finally recompute `total_space_used`.
        """
        from sqlmodel import select

        from app.db import get_session
        from app.models.config import Config
        from app.models.files import File

        total_available_space: int | None = None

        try:
            async for session in get_session():
                # Load config and DB file list using FastAPI session dependency
                result = await session.exec(select(Config))
                config = result.first()
                total_available_space = config.total_storage_limit if config else None

                # Ensure state exists and update available space. Use `patch`
                # so we always write a canonical AppState JSON and remove any
                # stale/unknown fields that might remain in Redis.
                await cls.patch(total_available_space=total_available_space)

                # Recompute total_space_used from DB for active (non-expired) files
                now = datetime.now(timezone.utc)
                active_q = select(File).where(
                    File.expires_at > now,
                    File.download_count < File.expire_after_n_download,
                )
                result = await session.exec(active_q)
                active_files = result.all()
                total_space_used = 0
                for f in active_files:
                    total_space_used += int(f.size or 0)

                # Persist the recalculated totals
                await cls.patch(
                    total_space_used=total_space_used,
                    total_available_space=total_available_space,
                )
                break
        except Exception:
            # Best-effort: update available space if we have it
            try:
                await cls.patch(total_available_space=total_available_space)
            except Exception:
                pass

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
