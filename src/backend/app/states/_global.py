from typing import Any, ClassVar

import redis.asyncio as redis


class GlobalState:
    _redis: ClassVar[redis.Redis]

    @classmethod
    def init_redis(cls, redis_client: redis.Redis) -> None:
        """Set the shared Redis client. Called once at startup."""
        cls._redis = redis_client

    @classmethod
    def _client(cls, redis_client: redis.Redis | None = None) -> redis.Redis:
        return redis_client or cls._redis

    @classmethod
    async def _json_get(
        cls, key: str, redis_client: redis.Redis | None = None
    ) -> dict[str, Any] | None:
        return await cls._client(redis_client).json().get(key)  # type: ignore[misc]

    @classmethod
    async def _json_set(
        cls, key: str, payload: dict[str, Any], redis_client: redis.Redis | None = None
    ) -> None:
        await cls._client(redis_client).json().set(key, "$", payload)  # type: ignore[misc]

    @classmethod
    async def _publish(
        cls, channel: str, message: str, redis_client: redis.Redis | None = None
    ) -> None:
        await cls._client(redis_client).publish(channel, message)
