from app.singletons.redis import RedisClient
from typing import Any, Awaitable, ClassVar, cast

import redis.asyncio as redis


class GlobalState:
    _redis: ClassVar[redis.Redis]

    @classmethod
    def init_redis(cls) -> None:
        """Set the shared Redis client. Called once at startup."""
        redis_client = RedisClient.get()
        GlobalState._redis = redis_client

    @classmethod
    def _client(cls, redis_client: redis.Redis | None = None) -> redis.Redis:
        if redis_client is not None:
            return redis_client
        if getattr(GlobalState, "_redis", None) is None:
            GlobalState.init_redis()
        return GlobalState._redis

    @classmethod
    async def _json_get(
        cls, key: str, redis_client: redis.Redis | None = None
    ) -> dict[str, Any] | None:
        raw = await cast(Awaitable[Any], cls._client(redis_client).json().get(key))
        if isinstance(raw, list):
            return cast(dict[str, Any] | None, raw[0] if raw else None)
        return cast(dict[str, Any] | None, raw)

    @classmethod
    async def _json_set(
        cls, key: str, payload: dict[str, Any], redis_client: redis.Redis | None = None
    ) -> None:
        await cast(
            Awaitable[Any], cls._client(redis_client).json().set(key, "$", payload)
        )

    @classmethod
    async def _publish(
        cls, channel: str, message: str, redis_client: redis.Redis | None = None
    ) -> None:
        await cls._client(redis_client).publish(channel, message)
